import { expect, test } from 'bun:test'

import cases from './cases.json' with { type: 'json' }
import { protocolSchemas } from './comparison.ts'
import { protocolJSON } from './generate.ts'
import { validate } from './schema.ts'

test('TypeScript validates the same cross-language protocol fixtures as Go', () => {
  for (const item of cases) {
    const decode = () =>
      validate(
        protocolSchemas[item.schema as keyof typeof protocolSchemas],
        JSON.parse(item.json)
      )
    if (item.valid) expect(decode).not.toThrow()
    else expect(decode).toThrow()
  }
})

test('the embedded Go schema is exactly the TypeScript protocol description', async () => {
  expect(
    await Bun.file(
      new URL('../comparison/go/protocol_schema.json', import.meta.url)
    ).json()
  ).toEqual(JSON.parse(protocolJSON()))
})
