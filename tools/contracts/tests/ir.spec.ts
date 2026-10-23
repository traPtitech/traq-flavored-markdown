import { expect, test } from 'bun:test'

import { normalizeContracts } from '../model/ir.ts'

test('request contracts retain omission, defaults, and named references', () => {
  const module = normalizeContracts(
    [
      {
        title: 'Options',
        type: 'object',
        additionalProperties: false,
        properties: {
          origin: { type: 'string', default: '' },
          nested: { $ref: '#/$defs/Nested' }
        },
        required: ['nested'],
        $defs: {
          Nested: {
            type: 'object',
            additionalProperties: false,
            properties: {},
            required: []
          }
        }
      }
    ],
    { Options: 'request' }
  )
  const options = module.definitions.get('Options')!
  expect(options.direction).toBe('request')
  expect(options.shape).toMatchObject({
    kind: 'object',
    fields: [
      {
        name: 'origin',
        required: false,
        default: '',
        shape: { kind: 'string' }
      },
      {
        name: 'nested',
        required: true,
        shape: { kind: 'reference', name: 'Nested' }
      }
    ]
  })
  expect(module.definitions.get('Nested')?.direction).toBe('request')
})
