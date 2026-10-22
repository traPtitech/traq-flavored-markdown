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
    abi: {
      version: 1,
      exports: { parse: { params: ['i32', 'i64'] } },
      operations: { configure: { requestSchema: 'Options' } }
    },
    nodes: {
      value: {
        schema: { type: 'array', items: { type: 'string' }, maxItems: 5 },
        structure: { role: 'inline' }
      }
    },
    directions: { Options: 'request' as const },
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
    abi: { operations: { configure: { requestSchema: 'Before' } } },
    nodes: {},
    processing: { Before: request },
    directions: { Before: 'request' as const }
  }
  const second = {
    abi: { operations: { configure: { requestSchema: 'After' } } },
    nodes: {},
    processing: { After: { ...request, title: 'After', format: 'uint16' } },
    directions: { After: 'request' as const }
  }
  expect(semanticContractId(first)).toBe(semanticContractId(second))
  expect(
    semanticContractId({
      ...second,
      abi: { operations: { configure: { responseSchema: 'After' } } },
      directions: { After: 'response' }
    })
  ).not.toBe(semanticContractId(first))
})

test('wire identity binds request and response shapes to their operations', () => {
  const manifest = {
    abi: {
      operations: {
        first: {
          requestSchema: 'FirstRequest',
          responseSchema: 'FirstResponse'
        },
        second: {
          requestSchema: 'SecondRequest',
          responseSchema: 'SecondResponse'
        }
      }
    },
    nodes: {},
    processing: {
      FirstRequest: { type: 'string' },
      SecondRequest: { type: 'boolean' },
      FirstResponse: { type: 'string' },
      SecondResponse: { type: 'boolean' }
    },
    directions: {
      FirstRequest: 'request' as const,
      SecondRequest: 'request' as const,
      FirstResponse: 'response' as const,
      SecondResponse: 'response' as const
    }
  }
  for (const field of ['requestSchema', 'responseSchema'] as const) {
    const swapped = structuredClone(manifest)
    const { first, second } = swapped.abi.operations
    const previous = first[field]
    first[field] = second[field]
    second[field] = previous
    expect(semanticContractId(swapped)).not.toBe(semanticContractId(manifest))
  }
  const unresolved = structuredClone(manifest)
  unresolved.abi.operations.first.requestSchema = 'Missing'
  expect(() => semanticContractId(unresolved)).toThrow(
    '$.abi.operations.first.requestSchema'
  )
})

test('reachable helper roots do not add wire semantics or make type names significant', () => {
  const helper = { type: 'string' }
  const manifest = {
    abi: { operations: { configure: { requestSchema: 'Options' } } },
    nodes: {},
    processing: {
      Options: {
        type: 'object',
        additionalProperties: false,
        properties: { value: { $ref: '#/$defs/Helper' } },
        $defs: { Helper: helper }
      },
      Helper: helper
    },
    directions: { Options: 'request' as const, Helper: 'request' as const }
  }
  const renamed = {
    ...manifest,
    processing: {
      Options: {
        ...manifest.processing.Options,
        properties: { value: { $ref: '#/$defs/Renamed' } },
        $defs: { Renamed: helper }
      },
      Renamed: helper
    },
    directions: { Options: 'request' as const, Renamed: 'request' as const }
  }
  expect(semanticContractId(renamed)).toBe(semanticContractId(manifest))
  expect(
    semanticContractId({
      ...manifest,
      processing: { Options: manifest.processing.Options },
      directions: { Options: 'request' }
    })
  ).toBe(semanticContractId(manifest))
})
