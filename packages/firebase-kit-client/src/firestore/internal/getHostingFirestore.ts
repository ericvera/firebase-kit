import type { Firestore } from 'firebase/firestore'
import type { Firestore as FirestoreLite } from 'firebase/firestore/lite'
import { FirestoreVariant } from '../constants.js'
import type { FirestoreUtilsDependencies } from '../types.js'

export const createGetHostingFirestore = (
  dependencies: FirestoreUtilsDependencies,
) => {
  /**
   * Resolves the Firestore instance a read goes through: the full SDK for
   * anything that subscribes, the lite SDK otherwise, against either the app's
   * named database or the project default.
   */
  const getHostingFirestore = async (
    variant: FirestoreVariant,
  ): Promise<Firestore | FirestoreLite> => {
    const { getApp } = await import('firebase/app')
    const app = getApp()

    const databaseId = dependencies.databaseId()

    if (variant === FirestoreVariant.Firestore || dependencies.useFullSDK()) {
      const { getFirestore } = await import('firebase/firestore')

      return databaseId === undefined
        ? getFirestore(app)
        : getFirestore(app, databaseId)
    }

    const { getFirestore } = await import('firebase/firestore/lite')

    return databaseId === undefined
      ? getFirestore(app)
      : getFirestore(app, databaseId)
  }

  return getHostingFirestore
}
