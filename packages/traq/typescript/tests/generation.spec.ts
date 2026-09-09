import { write } from 'bun'
import { expect, test } from 'bun:test'

import { goNodes } from '../../../../scripts/codegen/go.ts'
import { nodeFiles } from '../../../../scripts/codegen/nodes.ts'
import { typescriptFiles } from '../../../../scripts/codegen/traq/nodes-typescript.ts'
import { presetFiles } from '../../../../scripts/codegen/traq/presets.ts'
import { withTempDirectory } from './temp-directory.ts'

test('new Rust-exported payloads and presets generate both host APIs', async () => {
  await withTempDirectory('markdown-contract-', async directory => {
    // The same inputs produced by ts-rs and schemars for a new Rust node.
    await write(
      `${directory}/BadgeData.ts`,
      'export type BadgeData = { label:string; active:boolean };\n'
    )
    await write(
      `${directory}/ParseError.ts`,
      'export type ParseError = {code:"internal_error"};\n'
    )
    const schema = {
      title: 'BadgeData',
      type: 'object',
      additionalProperties: false,
      properties: { label: { type: 'string' }, active: { type: 'boolean' } },
      required: ['label', 'active']
    }
    const key = 'custom::BadgeData'

    const manifest = { nodes: { [key]: { schema, group: 'custom' } } }
    const generated = await typescriptFiles(manifest, directory)
    expect((await nodeFiles(manifest, directory)).get('custom.ts')).toMatch(
      /kind: "custom::BadgeData"; data: BadgeData/
    )
    expect(generated.get('typescript/generated/nodes.ts')).toMatch(
      /custom.NodeKind/
    )
    const go = goNodes([[key, schema]])
    for (const expected of [
      /Label string/,
      /Active bool/,
      /case BadgeName: return &Badge\{\}/
    ])
      expect(go).toMatch(expected)
    expect(() =>
      goNodes([
        [key, schema],
        ['another::BadgeData', schema]
      ])
    ).toThrow(/Duplicate generated payload type/)
    const presets = presetFiles({ commonmark: 0, custom: { compact: 1 } })
    expect(presets.get('typescript/generated/presets.ts')).toMatch(
      /"custom.compact"/
    )
    expect(presets.get('go/generated_presets.go')).toMatch(
      /PresetCustomCompact Preset = "custom.compact"/
    )
  })
})

test('Rust processing options and nested results generate without host changes', async () => {
  const { processingFiles } =
    await import('../../../../scripts/codegen/traq/processing.ts')
  await withTempDirectory('processing-contract-', async directory => {
    const object = (title: string, properties: Record<string, unknown>) => ({
      title,
      type: 'object',
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
      $defs: undefined as Record<string, { title: string }> | undefined
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
    await write(
      `${directory}/ExtractorOptions.ts`,
      'import type { Details } from "./Details.js";\nexport type ExtractorOptions = { compact:boolean; details:Details };'
    )
    await write(
      `${directory}/Extraction.ts`,
      'import type { Details } from "./Details.js";\nexport type Extraction = { details:Details; batches:Array<Details> };'
    )
    await write(
      `${directory}/Details.ts`,
      'export type Details = { labels:Array<string> };'
    )
    const schemas = {
      ExtractorOptions: options,
      Extraction: output
    }
    const files = await processingFiles(schemas, directory)
    const go = files.get('go/generated_processing.go')
    expect(go).toMatch(/Compact bool/)
    expect(go).toMatch(/Batches \[\]Details/)
    expect(go).toMatch(/Labels \[\]string/)
    expect(go.match(/type Details struct/g)).toHaveLength(1)
    const ts = files.get('typescript/generated/processing.ts')
    expect(ts).toMatch(/compact:boolean/)
    expect(ts).toMatch(/batches:Array<Details>/)
    expect(ts.match(/export type Details/g)).toHaveLength(1)
    output.$defs = {
      Details: object('Details', { other: { type: 'boolean' } })
    }
    await expect(processingFiles(schemas, directory)).rejects.toThrow(
      /Conflicting processing type/
    )
  })
})
