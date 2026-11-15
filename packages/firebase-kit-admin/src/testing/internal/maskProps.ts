import { Buffer } from 'node:buffer'
import { Timestamp } from 'firebase-admin/firestore'
import { readPath } from './readPath.js'
import { writePath } from './writePath.js'

const getTypeName = (value: unknown): string => {
  if (value instanceof Timestamp) {
    return 'Timestamp'
  }

  // Masking used to run after normalization had turned a Buffer into a string,
  // and consumer snapshots hold that token.
  if (Buffer.isBuffer(value)) {
    return 'String'
  }

  if (value === null) {
    return 'Null'
  }

  if (Array.isArray(value)) {
    return 'Array'
  }

  switch (typeof value) {
    case 'string':
      return 'String'
    case 'number':
      return 'Number'
    case 'boolean':
      return 'Boolean'
    default:
      return 'Map'
  }
}

export const getTypeToken = (
  value: unknown,
  label?: 'before' | 'after',
): string => {
  const typeName = getTypeName(value)

  return label ? `/${typeName} (${label})/` : `/${typeName}/`
}

// Each mask entry is a dotted field path, as in a Firestore `update()`.
export const maskProps = <T>(
  a: T,
  collection: string,
  maskKeys: Partial<Record<string, readonly string[]>>,
): T => {
  if (typeof a !== 'object' || Array.isArray(a) || a === null) {
    return a
  }

  const keys = maskKeys[collection]

  if (keys) {
    const obj = a as Record<string, unknown>

    for (const key of keys) {
      const value = readPath(obj, key)

      if (value === undefined) {
        continue
      }

      writePath(obj, key, getTypeToken(value))
    }
  }

  return a
}
