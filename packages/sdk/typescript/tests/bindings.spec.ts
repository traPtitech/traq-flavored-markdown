import path from 'path'

import { defineNode } from '@traq-flavored-markdown/core'
import { file } from 'bun'
import { expect, test } from 'bun:test'

import { goPayload } from '../../../../tools/contracts/emitters/go.js'
import { emitTypeScriptValidators } from '../../../../tools/contracts/emitters/typescript-validators.js'
import { type Shape, shape } from '../../../../tools/contracts/model/schema.js'
import {
  definitions,
  isKnownNode,
  schema as sdkSchema
} from '../../dist/generated/nodes.js'
import { isGrammarPresetId, presets } from '../../dist/generated/presets.js'
import { nodeContractsDirectory } from '../../scripts/node-contracts.js'

const manifest = JSON.parse(
  await file(path.join(nodeContractsDirectory(), 'contracts.json')).text()
) as { nodes: Record<string, { schema: { required?: string[] } }> }

function example(s: Shape): unknown {
  if (s.kind === 'string') return 'value'
  if (s.kind === 'integer' || s.kind === 'number') return s.min
  if (s.kind === 'boolean') return false
  if (s.kind === 'enum') return s.values[0]
  if (s.kind === 'literal') return s.value
  if (s.kind === 'nullable') return null
  if (s.kind === 'array') return [example(s.items)]
  if (s.kind === 'union') return example(s.variants[0])
  if (s.kind !== 'object') throw new Error('Unsupported example shape')

  return Object.fromEntries(s.fields.map(f => [f.name, example(f.shape)]))
}

test('generated optional TypeScript guards enforce every exported payload shape', () => {
  for (const [name, schema] of Object.entries(manifest.nodes).map(
    ([key, value]): [string, { required?: string[] }] => [key, value.schema]
  )) {
    const valid = example(shape(schema)) as Record<string, unknown>,
      check = Object.values(definitions).find(
        definition => definition.kind === name
      )?.validateData
    if (!check) throw new Error(`Missing generated validator: ${name}`)
    expect(check(valid)).toBeTruthy()
    expect(check({ ...valid, unexpected: true })).toBeFalsy()
    expect(check(null)).toBeFalsy()
    for (const field of schema.required ?? []) {
      const missing: Record<string, unknown> = { ...valid }
      delete missing[field]
      expect(check(missing)).toBeFalsy()
      expect(check({ ...valid, [field]: [] })).toBeFalsy()
    }
  }
  const reference = definitions.Reference.validateData
  const cell = definitions.Cell.validateData
  expect(
    !reference({
      type: 'other',
      id: 'u',
      label: '@u'
    })
  ).toBeTruthy()
  expect(!cell({ alignment: 'other' })).toBeTruthy()
})

test('schema extensions cannot change the SDK type guard or public definitions', () => {
  const candidate = { kind: 'forged', data: {}, span: { start: 0, end: 0 } }
  expect(isKnownNode(candidate)).toBe(false)
  const extended = sdkSchema.extend([defineNode('forged', () => true)])
  expect(extended.isKnownNode(candidate)).toBe(true)
  expect(isKnownNode(candidate)).toBe(false)
  expect(Object.isFrozen(definitions)).toBe(true)
  expect(Object.values(definitions).every(Object.isFrozen)).toBe(true)
})

test('published grammar preset values are immutable at runtime', () => {
  expect(Object.isFrozen(presets)).toBe(true)
  expect(Object.isFrozen(presets.traq)).toBe(true)
  expect(presets.traq.v1).toBe('traq.v1')
  expect(isGrammarPresetId(presets.commonmark)).toBe(true)
  expect(isGrammarPresetId(presets.traq.v1)).toBe(true)
  expect(isGrammarPresetId('traq.unknown')).toBe(false)
})

test('unsupported schema constraints fail generation instead of weakening validation', () => {
  const schema = {
    title: 'Example',
    type: 'object',
    additionalProperties: false,
    properties: { value: { type: 'string', pattern: 'secret' } },
    required: ['value']
  }
  expect(() => emitTypeScriptValidators([['test/example@1', schema]])).toThrow(
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
    expect(() => shape(unsupported)).toThrow()
  const recursive = { $ref: '#/$defs/Value' }
  expect(() => shape(recursive, { $defs: { Value: recursive } })).toThrow(
    /Recursive payload schemas/
  )
  const plain = { ...schema, properties: { value: { type: 'string' } } }
  expect(() =>
    emitTypeScriptValidators([
      ['test/example@1', plain],
      ['other/example@1', { ...plain, title: 'ExampleData' }]
    ])
  ).not.toThrow()
  expect(() =>
    emitTypeScriptValidators([
      ['test/example@1', plain],
      ['other/example@1', plain]
    ])
  ).toThrow(/Duplicate generated payload type/)
})
