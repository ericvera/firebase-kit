import type { FieldPath, Timestamp } from 'firebase-admin/firestore'
import type { https, onInit, pubsub } from 'firebase-functions'
import type { defineSecret, defineString } from 'firebase-functions/params'

/**
 * Options for the `firebase-admin/firestore` mock a suite installs in its
 * `__mocks__` directory.
 */
export interface FirebaseAdminFirestoreMockOptions {
  /**
   * The real module, obtained by the caller with `vi.importActual`. Its
   * `FieldPath` and `Timestamp` are handed back untouched, since tests build
   * real values with them and only the query surface needs faking.
   */
  actual: {
    FieldPath: typeof FieldPath
    Timestamp: typeof Timestamp
  }
  /** Value the faked Firestore instance reports as its `databaseId`. */
  databaseId: string
}

/**
 * Options for the `firebase-functions` mock a suite installs in its
 * `__mocks__` directory.
 */
export interface FirebaseFunctionsMockOptions {
  /**
   * The real module, obtained by the caller with `vi.importActual`. Only the
   * logger is faked; the function builders are handed back untouched.
   */
  actual: {
    https: typeof https
    onInit: typeof onInit
    pubsub: typeof pubsub
  }
}

/**
 * Options for the `firebase-functions/params` mock a suite installs in its
 * `__mocks__` directory.
 */
export interface FirebaseFunctionsParamsMockOptions {
  /**
   * The real module, obtained by the caller with `vi.importActual`. Its
   * `defineSecret` / `defineString` build the parameter instances, so the
   * mocks keep the real classes' behavior apart from the resolved value.
   */
  actual: {
    defineSecret: typeof defineSecret
    defineString: typeof defineString
  }
  /**
   * Value each secret resolves to, keyed by secret name. Names absent from the
   * map fall back to `mock-secret-${name}`. Called on each `.value()` read, so
   * the map can be built from application constants that are still mid-import
   * when the mock module evaluates.
   */
  secretValues: () => Record<string, string>
}
