import path from 'path'

import { file } from 'bun'
import { expect, test } from 'bun:test'

import { nodeContractsDirectory } from '../../../../scripts/build/node-contracts.ts'
import { goPayload } from '../../../../scripts/codegen/go.ts'
import { javascript } from '../../../../scripts/codegen/javascript.ts'
import { shape } from '../../../../scripts/codegen/schema.ts'
import { names, nodes } from '../../dist/generated/nodes.js'

const manifest = JSON.parse(
  await file(path.join(nodeContractsDirectory(), 'contracts.json')).text()
) as { nodes: Record<string, { schema: { required?: string[] } }> }

function example(s) {
  if (s.kind === 'string') return 'value'
  if (s.kind === 'integer') return s.min
  if (s.kind === 'boolean') return false
  if (s.kind === 'enum') return s.values[0]
  if (s.kind === 'nullable') return null
  return Object.fromEntries(s.fields.map(f => [f.name, example(f.shape)]))
}

test('generated optional TypeScript guards enforce every exported payload shape', () => {
  for (const [name, schema] of Object.entries(manifest.nodes).map(
    ([key, value]): [string, { required?: string[] }] => [key, value.schema]
  )) {
    const valid = example(shape(schema)),
      check = nodes.get(name)
    if (!check) throw new Error(`Missing generated validator: ${name}`)
    expect(check(valid)).toBeTruthy()
    expect(check({ ...valid, unexpected: true })).toBeFalsy()
    expect(check(null)).toBeFalsy()
    for (const field of schema.required ?? []) {
      const missing = { ...valid }
      delete missing[field]
      expect(check(missing)).toBeFalsy()
      expect(check({ ...valid, [field]: [] })).toBeFalsy()
    }
  }
  const reference = nodes.get(names.Reference)
  const cell = nodes.get(names.Cell)
  if (!reference || !cell) throw new Error('Missing generated validator')
  expect(
    !reference({
      type: 'other',
      id: 'u',
      label: '@u'
    })
  ).toBeTruthy()
  expect(!cell({ alignment: 'other' })).toBeTruthy()
})

test('unsupported schema constraints fail generation instead of weakening validation', () => {
  const schema = {
    title: 'Example',
    type: 'object',
    additionalProperties: false,
    properties: { value: { type: 'string', pattern: 'secret' } },
    required: ['value']
  }
  expect(() => javascript([['test/example@1', schema]])).toThrow(
    /Unsupported schema keyword/
  )
  expect(() => goPayload('test/example@1', schema)).toThrow(
    /Unsupported schema keyword/
  )
  for (const unsupported of [
    { type: ['string', 'null'], enum: ['restricted', null] },
    { type: 'string', anyOf: [{ type: 'string' }, { type: 'null' }] },
    { $ref: '#/$defs/Value', type: 'boolean' },
    { anyOf: [{ type: 'string' }, { type: 'null', enum: [null] }] }
  ])
    expect(() => shape(unsupported)).toThrow(/Unsupported schema keyword/)
  const recursive = { $ref: '#/$defs/Value' }
  expect(() => shape(recursive, { $defs: { Value: recursive } })).toThrow(
    /Recursive payload schemas/
  )
  const plain = { ...schema, properties: { value: { type: 'string' } } }
  expect(() =>
    javascript([
      ['test/example@1', plain],
      ['other/example@1', { ...plain, title: 'ExampleData' }]
    ])
  ).toThrow(/Duplicate generated payload type/)
})
