/**
 * The code Firestore puts on a read rejected by security rules. Bare and
 * canonical — no `functions/` prefix, unlike the callable variants — and the
 * subscription error path keys on it to tell a logout teardown race apart from
 * a real denial.
 */
export const FirestorePermissionDeniedCode = 'permission-denied'
