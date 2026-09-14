import { expect, test } from 'bun:test'

import { loadRuntime, presets } from '../../dist/browser.js'
import { names } from '../../dist/generated/nodes.js'

test('browser runtime loads the packaged Wasm once', async () => {
  const [first, second] = await Promise.all([loadRuntime(), loadRuntime()])
  expect(first).toBe(second)
  expect('dispose' in first).toBe(false)

  const parser = first.createParser(presets.traq.v1)
  try {
    expect(parser.parseInline(':stamp:').children[0].kind).toBe(names.Stamp)
  } finally {
    parser.dispose()
  }
})
