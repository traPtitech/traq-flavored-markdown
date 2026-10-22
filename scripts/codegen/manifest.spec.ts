import { expect, test } from 'bun:test'

import { parseArtifactMetadata, parseNodeManifest } from './manifest.ts'

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
