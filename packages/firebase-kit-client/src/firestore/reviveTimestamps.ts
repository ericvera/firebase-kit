import type { Timestamp } from 'firebase/firestore/lite'
import { FirestoreVariant } from './constants.js'
import { InvalidTimestampError } from './InvalidTimestampError.js'

interface RawTimestampFields {
  seconds: number
  nanoseconds: number
}

const isRawTimestamp = (a: unknown): boolean =>
  a !== null &&
  typeof a === 'object' &&
  (('seconds' in a && 'nanoseconds' in a) ||
    ('_seconds' in a && '_nanoseconds' in a))

const getSecondsAndNanoseconds = (
  rawTimestamp: RawTimestampFields,
): { seconds: number; nanoseconds: number } => {
  if ('_seconds' in rawTimestamp) {
    const callable = rawTimestamp as unknown as {
      _seconds: number
      _nanoseconds: number
    }

    return { seconds: callable._seconds, nanoseconds: callable._nanoseconds }
  }

  return rawTimestamp
}

const parseRawTimestamp = async (
  rawTimestamp: RawTimestampFields,
  variant: FirestoreVariant,
): Promise<Timestamp> => {
  const { seconds, nanoseconds } = getSecondsAndNanoseconds(rawTimestamp)

  if (
    (seconds as number | undefined) === undefined ||
    (nanoseconds as number | undefined) === undefined
  ) {
    throw new InvalidTimestampError()
  }

  if (variant === FirestoreVariant.FirestoreLite) {
    const { Timestamp } = await import('firebase/firestore/lite')

    return new Timestamp(seconds, nanoseconds)
  }

  const { Timestamp } = await import('firebase/firestore')

  return new Timestamp(seconds, nanoseconds)
}

const reviveTimestamp = async <T>(
  a: T,
  isRaw: (a: unknown) => boolean,
  // The lite SDK's Timestamp stands in for both variants here: the full SDK's
  // class is structurally identical, and naming a shared alias would have meant
  // a dependency on a type package this one must stay free of.
  timestampParser: (
    a: RawTimestampFields,
    variant: FirestoreVariant,
  ) => Promise<Timestamp>,
  variant: FirestoreVariant,
): Promise<T> => {
  if (typeof a !== 'object' || a === null) {
    return a
  }

  if (isRaw(a)) {
    return timestampParser(a as unknown as RawTimestampFields, variant) as T
  }

  if (Array.isArray(a)) {
    return (await Promise.all(
      a.map((item) => reviveTimestamp(item, isRaw, timestampParser, variant)),
    )) as T
  }

  const result: Record<string, unknown> = {}

  for (const key in a) {
    const value = a[key]

    if (isRaw(value)) {
      result[key] = await timestampParser(
        value as unknown as RawTimestampFields,
        variant,
      )
    } else if (typeof value === 'object') {
      result[key] = await reviveTimestamp(
        value,
        isRaw,
        timestampParser,
        variant,
      )
    } else {
      result[key] = value
    }
  }

  return result as T
}

/**
 * Rebuilds Firestore `Timestamp` instances from the plain
 * `{ seconds, nanoseconds }` (or callable-style `_seconds` / `_nanoseconds`)
 * objects that survive a JSON round trip, walking objects and arrays to any
 * depth. Used on every callable response and every cached read, so values
 * reaching the app carry the same Timestamp API a live Firestore read gives.
 *
 * @param value - The payload to walk
 * @param variant - Which Firestore SDK's Timestamp class to construct
 */
export const reviveTimestamps = async <T>(
  value: T,
  variant: FirestoreVariant,
): Promise<T> => {
  const valueWithTimestamps = await reviveTimestamp<T>(
    value,
    isRawTimestamp,
    (rawTimestamp, timestampVariant) =>
      parseRawTimestamp(rawTimestamp, timestampVariant),
    variant,
  )

  return valueWithTimestamps
}
