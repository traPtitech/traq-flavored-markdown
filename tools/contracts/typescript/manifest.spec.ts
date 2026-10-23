import { expect, test } from 'bun:test'

import {
  parseArtifactManifest,
  parseArtifactMetadata,
  parseNodeManifest
} from './manifest.ts'

test('manifest loading validates contracts before generators observe them', () => {
  const source = {
    nodes: {
      text: {
        group: 'commonmark',
        schema: { type: 'string' },
        structure: { role: 'inline', children: { kind: 'leaf' } }
      }
    }
  }
  expect<unknown>(parseNodeManifest(source)).toEqual(source)
  const wrongRole = structuredClone(source)
  wrongRole.nodes.text.structure.role = 'unknown'
  expect(() => parseNodeManifest(wrongRole)).toThrow(
    '$.nodes.text.structure.role'
  )
  const wrongSchema = structuredClone(source)
  wrongSchema.nodes.text.schema.type = 'missing'
  expect(() => parseNodeManifest(wrongSchema)).toThrow('$.nodes.text.schema')
  expect(() => parseNodeManifest({ nodes: { text: null } })).toThrow(
    '$.nodes.text'
  )
})

test('artifact metadata has one checked limits and provenance boundary', () => {
  const value = {
    contractId: 'contract',
    provenance: { sourceFingerprint: 'source' },
    presets: { traq: { v1: 0 } },
    limits: {
      inputBytes: 100,
      outputBytes: 100,
      memoryBytes: 65536,
      document: { sourceBytes: 10, payloadBytes: 50, nodes: 10, depth: 3 }
    }
  }
  expect(parseArtifactMetadata(value)).toEqual(value)
  value.limits.document.depth = 0.5
  expect(() => parseArtifactMetadata(value)).toThrow('$.limits.document.depth')
})

test('ABI manifests reject unsupported values and inconsistent operation references', () => {
  const source = {
    contractId: 'contract',
    provenance: { sourceFingerprint: 'source' },
    presets: { traq: { v1: 0 } },
    nodes: {},
    processing: {},
    directions: {},
    limits: {
      inputBytes: 100,
      outputBytes: 100,
      memoryBytes: 65536,
      document: { sourceBytes: 10, payloadBytes: 50, nodes: 10, depth: 3 }
    },
    abi: {
      version: 1,
      error: { type: 'string' },
      operations: {
        render: {
          export: 'render',
          input: 'json',
          params: ['i32'],
          result: 'text',
          configuration: false
        }
      },
      exports: { render: { params: ['i32'], results: ['i32'] } }
    }
  }
  expect<unknown>(parseArtifactManifest(source)).toEqual(source)
  const unsupported = structuredClone(source)
  unsupported.abi.operations.render.result = 'unknown'
  expect(() => parseArtifactManifest(unsupported)).toThrow(
    '$.abi.operations.render.result'
  )
  const missing = structuredClone(source)
  missing.abi.operations.render.export = 'missing'
  expect(() => parseArtifactManifest(missing)).toThrow(
    '$.abi.operations.render.export'
  )
  const mismatched = structuredClone(source)
  mismatched.abi.exports.render.params = []
  expect(() => parseArtifactManifest(mismatched)).toThrow(
    '$.abi.operations.render.export'
  )
  const signature = structuredClone(source)
  signature.abi.exports.render.results = ['f64']
  expect(() => parseArtifactManifest(signature)).toThrow(
    '$.abi.exports.render.results[0]'
  )
  const configuration = structuredClone(source)
  configuration.abi.operations.render.configuration = true
  expect(() => parseArtifactManifest(configuration)).toThrow(
    '$.abi.operations.render.configuration'
  )
  const direction = { ...source, processing: { Options: { type: 'string' } } }
  expect(() => parseArtifactManifest(direction)).toThrow('$.directions.Options')
})

test('processing schemas resolve per operation and reject disconnected roots', () => {
  const helper = { type: 'string' }
  const source = {
    contractId: 'contract',
    provenance: { sourceFingerprint: 'source' },
    presets: {},
    nodes: {},
    limits: {
      inputBytes: 100,
      outputBytes: 100,
      memoryBytes: 65536,
      document: { sourceBytes: 10, payloadBytes: 50, nodes: 10, depth: 3 }
    },
    abi: {
      version: 1,
      error: { type: 'string' },
      operations: {
        process: {
          export: 'process',
          input: 'json',
          params: [],
          result: 'processing',
          configuration: false,
          requestSchema: 'Request',
          responseSchema: 'Response'
        }
      },
      exports: { process: { params: [], results: ['i32'] } }
    },
    processing: {
      Request: {
        type: 'object',
        additionalProperties: false,
        properties: { value: { $ref: '#/$defs/Helper' } },
        $defs: { Helper: helper }
      },
      Helper: helper,
      Response: { type: 'boolean' }
    },
    directions: { Request: 'request', Helper: 'request', Response: 'response' }
  }
  expect<unknown>(parseArtifactManifest(source)).toEqual(source)
  for (const field of ['requestSchema', 'responseSchema'] as const) {
    const missing = structuredClone(source)
    missing.abi.operations.process[field] = 'Missing'
    expect(() => parseArtifactManifest(missing)).toThrow(
      `$.abi.operations.process.${field}`
    )
  }
  const direction = structuredClone(source)
  direction.directions.Response = 'request'
  expect(() => parseArtifactManifest(direction)).toThrow(
    '$.abi.operations.process.responseSchema'
  )
  const helperDirection = structuredClone(source)
  helperDirection.directions.Helper = 'response'
  expect(() => parseArtifactManifest(helperDirection)).toThrow(
    '$.directions.Helper'
  )
  const unreferenced = {
    ...source,
    processing: { ...source.processing, Unused: { type: 'string' } },
    directions: { ...source.directions, Unused: 'request' }
  }
  expect(() => parseArtifactManifest(unreferenced)).toThrow(
    '$.processing.Unused'
  )
  const unusedDefinition = {
    ...source,
    processing: {
      ...source.processing,
      Request: {
        ...source.processing.Request,
        properties: { value: { type: 'string' } }
      }
    }
  }
  expect(() => parseArtifactManifest(unusedDefinition)).toThrow(
    '$.processing.Helper'
  )
})
