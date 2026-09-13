import * as rendering from '@traq-markdown-engine/sdk/renderer'
import { renderer } from '@traq-markdown-engine/core/renderer'
import { file } from 'bun'
import { expect, test } from 'bun:test'

import { parser } from './setup.ts'

const fixtures = JSON.parse(
  await file(
    new URL('./fixtures/renderer-corpus-regressions.json', import.meta.url)
  ).text()
)

const view = renderer(rendering.html())

for (const { name, markdown, html } of fixtures)
  test('corpus regression: ' + name, () => {
    expect(view.render(parser.parse(markdown))).toBe(html)
  })
