/**
 * Which Firestore SDK a payload came from. Timestamp revival has to know,
 * because the full SDK and the lite SDK ship incompatible Timestamp classes.
 */
export enum FirestoreVariant {
  Firestore = 'firestore',
  FirestoreLite = 'firestore-lite',
}
