import path from 'node:path'

import { pathToFileURL, write } from 'bun'
import { expect, test } from 'bun:test'
import ts from 'typescript'

import { withTempDirectory } from '../../workspace/infrastructure/temp-directory.ts'
import { packageRoot } from '../../workspace/paths.ts'
import { normalizeContracts } from './ir.ts'
import { type RawSchema, shape } from './schema.ts'
import { emitTypeScriptValidators } from './typescript-validators.ts'

test('string bounds remain in normalized contracts and reject malformed constraints', () => {
  const bounded = { type: 'string', minLength: 2, maxLength: 2 }
  const module = normalizeContracts([
    {
      title: 'Label',
      type: 'object',
      additionalProperties: false,
      properties: { value: bounded },
      required: ['value']
    }
  ])
  expect(module.definitions.get('Label')?.shape).toMatchObject({
    kind: 'object',
    fields: [{ shape: { kind: 'string', minLength: 2, maxLength: 2 } }]
  })
  expect(shape({ ...bounded, type: ['string', 'null'] })).toEqual({
    kind: 'nullable',
    inner: { kind: 'string', minLength: 2, maxLength: 2 }
  })
  for (const bound of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '2']) {
    expect(() => shape({ type: 'string', minLength: bound })).toThrow(
      /Invalid string length bound/
    )
    expect(() => shape({ type: 'string', maxLength: bound })).toThrow(
      /Invalid string length bound/
    )
  }
  expect(() => shape({ ...bounded, minLength: 3 })).toThrow(
    /Invalid string length bounds/
  )
  expect(() => shape({ ...bounded, pattern: '[a-z]+' })).toThrow(
    /Unsupported schema keyword/
  )
})

test('generated string validators count Unicode scalars rather than bytes, UTF-16 units or graphemes', async () => {
  const schema: RawSchema = {
    title: 'Text',
    type: 'object',
    additionalProperties: false,
    properties: {
      value: { type: 'string', minLength: 2, maxLength: 2 },
      lower: { type: 'string', minLength: 2 },
      upper: { type: 'string', maxLength: 2 },
      empty: { type: 'string', maxLength: 0 }
    },
    required: ['value', 'lower', 'upper', 'empty']
  }
  const generated = emitTypeScriptValidators(
    [['example::Text', schema]],
    pathToFileURL(
      path.join(packageRoot('core'), 'typescript', 'src', 'validation.ts')
    ).href,
    pathToFileURL(
      path.join(packageRoot('core'), 'typescript', 'src', 'nodes.ts')
    ).href
  )
  const compiled = ts.transpileModule(generated, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }).outputText
  await withTempDirectory('traq-string-', async directory => {
    const filename = path.join(directory, 'text.mjs')
    await write(filename, compiled)
    const { nodes } = await import(pathToFileURL(filename).href)
    const validate = nodes.get('example::Text')
    const fields = { lower: '日😀字', upper: '', empty: '' }
    for (const value of ['ab', '日😀', 'e\u0301'])
      expect(validate({ ...fields, value })).toBe(true)
    for (const value of [
      '',
      '日',
      '😀',
      'abc',
      '日😀字',
      '\ud800x',
      'x\udc00',
      null,
      2
    ])
      expect(validate({ ...fields, value })).toBe(false)
    expect(validate({ ...fields, value: '日😀', lower: '😀' })).toBe(false)
    expect(validate({ ...fields, value: '日😀', upper: '日😀字' })).toBe(false)
    expect(validate({ ...fields, value: '日😀', empty: '😀' })).toBe(false)
  })
})
