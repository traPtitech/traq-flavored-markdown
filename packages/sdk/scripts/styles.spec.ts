import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import { NodePackageImporter, compile } from 'sass'

test('the SDK theme composes plugin CSS and supplies compact stamp overrides', () => {
  const css = compile(
    fileURLToPath(new URL('../styles/index.scss', import.meta.url)),
    { importers: [new NodePackageImporter()] }
  ).css
  expect(css).toContain('.markdown-body')
  expect(css).toContain('.spoiler')
  expect(css).toContain('.katex-block')
  expect(css).toContain(
    '--tfm-stamp-large-size: var(--tfm-stamp-normal-size, 24px)'
  )
  expect(css).toContain(
    '--tfm-stamp-ex-large-size: var(--tfm-stamp-normal-size, 24px)'
  )
  expect(css).toContain('var(--tfm-table-tr-background-color2, #f6f8fa)')
  expect(css).not.toContain('rotate(0.03deg)')
})
