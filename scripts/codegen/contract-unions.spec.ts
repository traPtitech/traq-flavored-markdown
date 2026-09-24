import path from 'node:path'

import { pathToFileURL, write } from 'bun'
import { expect, test } from 'bun:test'
import ts from 'typescript'

import { packageRoot } from '../paths.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'
import { javascript } from './javascript.ts'
import type { RawSchema } from './schema.ts'

test('tagged Rust unions validate their discriminators and variant fields', async () => {
  const schema: RawSchema = {
    title: 'StampData',
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { $ref: '#/$defs/StampKind' },
      animations: {
        type: 'array',
        items: { type: 'string', enum: ['rotate', 'rotate-inv'] }
      }
    },
    required: ['kind', 'animations'],
    $defs: {
      StampKind: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'normal' },
              name: { type: 'string' }
            },
            required: ['type', 'name']
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', const: 'hex_color' },
              name: { type: 'string' },
              rgb: {
                type: 'integer',
                format: 'uint32',
                minimum: 0,
                maximum: 0xffffffff
              }
            },
            required: ['type', 'name', 'rgb']
          }
        ]
      }
    }
  }
  const source = javascript(
    [['example::StampData', schema]],
    pathToFileURL(path.join(packageRoot('core'), 'typescript', 'validation.ts'))
      .href
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }).outputText
  await withTempDirectory('traq-union-', async directory => {
    const module = `${directory}/union.mjs`
    await write(module, compiled)
    const { nodes } = await import(pathToFileURL(module).href)
    const validate = nodes.get('example::StampData')
    expect(
      validate({ kind: { type: 'normal', name: 'x' }, animations: [] })
    ).toBe(true)
    expect(
      validate({
        kind: { type: 'hex_color', name: 'x', rgb: 0 },
        animations: ['rotate']
      })
    ).toBe(true)
    for (const kind of [
      { type: 'invalid', name: 'x' },
      { type: 'normal' },
      { type: 'normal', name: 'x', rgb: 0 },
      { type: 'hex_color', name: 'x', rgb: -1 }
    ])
      expect(validate({ kind, animations: [] })).toBe(false)
    expect(
      validate({ kind: { type: 'normal', name: 'x' }, animations: ['bad'] })
    ).toBe(false)
  })
})
