import { expect, it } from 'vitest'
import { createFirebaseAppMock } from './createFirebaseAppMock.js'

it('reports no apps until one is initialized', () => {
  const mock = createFirebaseAppMock()

  // Verify: the empty registry is what lets a suite exercise the
  // not-initialized-yet branch its subject guards on
  expect(mock.getApps()).toMatchInlineSnapshot(`[]`)
})

it('hands back the initialized app', () => {
  const mock = createFirebaseAppMock()

  mock.initializeApp({ projectId: 'demo-project' })

  // Verify: the options reach the app, so a subject that reads them off
  // `getApp()` sees what the suite configured
  expect(mock.getApp()).toMatchInlineSnapshot(`
    {
      "automaticDataCollectionEnabled": false,
      "name": "test-app-0",
      "options": {
        "projectId": "demo-project",
      },
    }
  `)
})

it('throws from getApp before anything is initialized', () => {
  const mock = createFirebaseAppMock()

  // Verify: matches the real module rather than returning undefined, so a
  // suite that forgot to seed an app fails where it forgot
  expect(() => mock.getApp()).toThrowErrorMatchingInlineSnapshot(
    `[Error: Firebase: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app)]`,
  )
})

it('empties the registry on reset', () => {
  const mock = createFirebaseAppMock()

  mock.initializeApp()
  mock.resetFirebaseAppMocks()

  // Verify: one shared instance backs every importer, so a suite has to be
  // able to clear it between cases
  expect(mock.getApps()).toMatchInlineSnapshot(`[]`)
})
