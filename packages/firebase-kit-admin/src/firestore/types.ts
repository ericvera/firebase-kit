/**
 * The per-app database ids `createFirestoreUtils` binds once at module scope.
 * `emulatorDatabaseId` is separate because the Firestore emulator only serves
 * the default database, whatever the deployed project names its own.
 */
export interface FirestoreUtilsOptions {
  databaseId: string
  emulatorDatabaseId: string
}
