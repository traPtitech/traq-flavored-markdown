import { expect, test } from 'bun:test'

import type { RawSchema } from '../../../scripts/codegen/schema.ts'
import { goNodes as sdkGoNodes } from './codegen/nodes-go.ts'
import { typescriptFiles } from './codegen/nodes-typescript.ts'
import { presetFiles } from './codegen/presets.ts'
import { processingFiles } from './codegen/processing.ts'

test('Rust-exported payloads and presets generate the traQ host API', () => {
  const schema = {
    title: 'BadgeData',
    type: 'object',
    additionalProperties: false,
    properties: { label: { type: 'string' }, active: { type: 'boolean' } },
    required: ['label', 'active']
  }
  const key = 'custom::BadgeData'

  const parseError: RawSchema = {
    title: 'ParseError',
    type: 'object',
    additionalProperties: false,
    properties: { code: { type: 'string', const: 'internal_error' } },
    required: ['code']
  }
  const manifest = {
    nodes: { [key]: { schema, group: 'trap' } },
    parseError
  }
  const generated = typescriptFiles(manifest)
  expect(generated.get('typescript/generated/nodes.ts')).toMatch(
    /trap.NodeKind/
  )
  expect(generated.get('typescript/generated/nodes.ts')).toMatch(
    /return validators\.get\(node\.kind\)/
  )
  expect(generated.get('typescript/generated/nodes.ts')).toContain(
    'export type ParseError ='
  )
  expect(sdkGoNodes({ nodes: { [key]: { group: 'trap' } } })).toContain(
    'packages/plugins/traq/go'
  )
  expect(() =>
    typescriptFiles({ nodes: { [key]: { group: 'custom' } }, parseError })
  ).toThrow('Unknown node contract group: custom')
  expect(() => sdkGoNodes({ nodes: { [key]: { group: 'custom' } } })).toThrow(
    'Unknown node contract group: custom'
  )
  const presets = presetFiles({ commonmark: 0, custom: { compact: 1 } })
  expect(presets.get('typescript/generated/presets.ts')).toMatch(
    /"custom.compact"/
  )
  expect(presets.get('typescript/generated/presets.ts')).toMatch(
    /Object\.freeze\(\{ "compact": "custom.compact" \} as const\)/
  )
  expect(presets.get('typescript/generated/presets.ts')).toContain(
    'export function isPreset(value: string): value is Preset'
  )
  expect(presets.get('go/generated_presets.go')).toMatch(
    /PresetCustomCompact Preset = "custom.compact"/
  )
})

test('Rust processing options and nested results generate without host changes', () => {
  const object = (
    title: string,
    properties: Record<string, RawSchema>
  ): RawSchema => ({
    title,
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
    $defs: undefined as Record<string, RawSchema> | undefined
  })
  const details = object('Details', {
    labels: { type: 'array', items: { type: 'string' } }
  })
  const options = object('ExtractorOptions', {
    compact: { type: 'boolean' },
    details: { $ref: '#/$defs/Details' }
  })
  options.$defs = { Details: details }
  const output = object('Extraction', {
    details: { $ref: '#/$defs/Details' },
    batches: { type: 'array', items: { $ref: '#/$defs/Details' } }
  })
  output.$defs = { Details: details }
  const schemas = {
    ExtractorOptions: options,
    Extraction: output
  }
  const files = processingFiles(schemas)
  const go = files.get('go/generated_processing.go')
  expect(go).toMatch(/Compact bool/)
  expect(go).toMatch(/Batches \[\]Details/)
  expect(go).toMatch(/Labels \[\]string/)
  expect(go).toContain('func (value *Extraction) UnmarshalJSON')
  expect(go!.match(/type Details struct/g)).toHaveLength(1)
  const ts = files.get('typescript/generated/processing.ts')
  expect(ts).toMatch(/"compact": boolean/)
  expect(ts).toMatch(/"batches": Array<Details>/)
  expect(ts!.match(/export type Details/g)).toHaveLength(1)
  output.$defs = {
    Details: object('Details', { other: { type: 'boolean' } })
  }
  expect(() => processingFiles(schemas)).toThrow(
    /Conflicting TypeScript contract/
  )
})
