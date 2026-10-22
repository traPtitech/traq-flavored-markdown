import { expect, test } from 'bun:test'

import { semanticContractId } from './node-contracts.ts'

test('contract identity is independent of order and provenance but includes semantic changes', () => {
  const first = {
    abi: { version: 1 },
    nodes: { text: { schema: { type: 'string' } } },
    provenance: { sourceFingerprint: 'a' },
    contractId: 'unbound'
  }
  const second = {
    contractId: 'old',
    provenance: { sourceFingerprint: 'b' },
    nodes: first.nodes,
    abi: first.abi
  }
  expect(semanticContractId(first)).toBe(semanticContractId(second))
  expect(semanticContractId({ ...first, abi: { version: 2 } })).not.toBe(
    semanticContractId(first)
  )
})

test('wire identity ignores schema documentation and unordered declarations', () => {
  const schema = {
    title: 'Original',
    description: 'Old documentation',
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'A real field named description'
      },
      flags: { type: 'string', enum: ['a', 'b'] }
    },
    required: ['description', 'flags'],
    additionalProperties: false
  }
  const first = { abi: { version: 1 }, nodes: { text: { schema } } }
  const second = structuredClone(first)
  second.nodes.text.schema.title = 'Renamed'
  second.nodes.text.schema.description = 'New documentation'
  second.nodes.text.schema.properties.description.description =
    'Edited field docs'
  second.nodes.text.schema.required.reverse()
  second.nodes.text.schema.properties.flags.enum.reverse()
  expect(semanticContractId(first)).toBe(semanticContractId(second))
  second.nodes.text.schema.properties.description.type = 'boolean'
  expect(semanticContractId(first)).not.toBe(semanticContractId(second))
})

test('wire identity retains defaults, structural constraints, bounds and ABI parameter order', () => {
  const first = {
    abi: { version: 1, exports: { parse: { params: ['i32', 'i64'] } } },
    nodes: {
      value: {
        schema: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        structure: { role: 'inline' }
      }
    },
    processing: {
      Options: {
        type: 'object',
        additionalProperties: false,
        properties: { enabled: { type: 'boolean', default: true } }
      }
    }
  }
  for (const change of [
    (value: typeof first) => {
      value.abi.exports.parse.params.reverse()
    },
    (value: typeof first) => {
      value.nodes.value.schema.maxItems = 6
    },
    (value: typeof first) => {
      value.nodes.value.structure.role = 'block'
    },
    (value: typeof first) => {
      value.processing.Options.properties.enabled.default = false
    }
  ]) {
    const changed = structuredClone(first)
    change(changed)
    expect(semanticContractId(first)).not.toBe(semanticContractId(changed))
  }
})

test('renaming a contract root and its bounded storage type leaves wire identity unchanged', () => {
  const request = {
    title: 'Before',
    type: 'integer',
    format: 'uint8',
    minimum: 0,
    maximum: 255
  }
  const first = {
    abi: {},
    nodes: {},
    processing: { Before: request },
    directions: { Before: 'request' as const }
  }
  const second = {
    abi: {},
    nodes: {},
    processing: { After: { ...request, title: 'After', format: 'uint16' } },
    directions: { After: 'request' as const }
  }
  expect(semanticContractId(first)).toBe(semanticContractId(second))
  expect(
    semanticContractId({ ...second, directions: { After: 'response' } })
  ).not.toBe(semanticContractId(first))
})
