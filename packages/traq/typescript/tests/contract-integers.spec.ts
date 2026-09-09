import { goPayload } from '@traq-markdown-parser/core/codegen/go'
import { javascript } from '@traq-markdown-parser/core/codegen/javascript'
import { shape } from '@traq-markdown-parser/core/codegen/schema'
import { pathToFileURL, write } from 'bun'
import { expect, test } from 'bun:test'
import ts from 'typescript'

import { withTempDirectory } from './temp-directory.ts'

test('generated numeric payload validators retain Rust integer bounds', async () => {
  for (const [format, maximum] of [
    ['uint8', 255],
    ['uint32', 0xffffffff]
  ]) {
    const schema = {
      title: 'Numeric',
      type: 'object',
      additionalProperties: false,
      properties: { value: { type: 'integer', format, minimum: 0, maximum } },
      required: ['value']
    }
    const generated = javascript(
      [['example::Numeric', schema]],
      import.meta.resolve('@traq-markdown-parser/core/validation')
    )
    const compiled = ts.transpileModule(generated, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext
      }
    }).outputText
    await withTempDirectory('traq-numeric-', async directory => {
      const generatedModule = `${directory}/numeric.mjs`
      await write(generatedModule, compiled)
      const { nodes } = await import(pathToFileURL(generatedModule).href)
      const validate = nodes.get('example::Numeric')
      for (const value of [0, 1, maximum])
        expect(validate({ value })).toBe(true)
      for (const value of [-1, maximum + 1, 0.5, null, '1', NaN, Infinity])
        expect(validate({ value })).toBe(false)
      expect(validate({})).toBe(false)
      expect(validate({ value: 1, extra: 1 })).toBe(false)
      expect(goPayload('example::Numeric', schema)).toMatch(
        new RegExp('Value ' + format)
      )
      expect(() => shape({ ...schema.properties.value, maximum: 6 })).toThrow(
        /Unsupported integer/
      )
      expect(() =>
        shape({ ...schema.properties.value, multipleOf: 2 })
      ).toThrow(/Unsupported schema keyword/)
      const withoutMaximum = { ...schema.properties.value }
      delete withoutMaximum.maximum
      expect(shape(withoutMaximum).max).toBe(maximum)
    })
  }
})
