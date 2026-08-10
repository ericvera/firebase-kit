import { expect, it } from 'vitest'
import { createOnCallGlobalOptions } from './createOnCallGlobalOptions.js'

it('builds the options object without a region key when no region is given', () => {
  const options = createOnCallGlobalOptions({
    cors: ['https://example.test'],
    enforceAppCheck: true,
  })

  // Verify: exactly `enforceAppCheck` and `cors` — an explicit
  // `region: undefined` would reach the SDK as a set-but-empty option
  expect(options).toMatchInlineSnapshot(`
    {
      "cors": [
        "https://example.test",
      ],
      "enforceAppCheck": true,
    }
  `)
  expect(Object.keys(options)).toMatchInlineSnapshot(`
    [
      "enforceAppCheck",
      "cors",
    ]
  `)
})

it('includes the region when one is given', () => {
  const options = createOnCallGlobalOptions({
    cors: ['https://example.test', 'https://other.test'],
    enforceAppCheck: false,
    region: 'us-east4',
  })

  // Verify: every field is passed through as configured, including an
  // `enforceAppCheck` the caller turned off
  expect(options).toMatchInlineSnapshot(`
    {
      "cors": [
        "https://example.test",
        "https://other.test",
      ],
      "enforceAppCheck": false,
      "region": "us-east4",
    }
  `)
})
