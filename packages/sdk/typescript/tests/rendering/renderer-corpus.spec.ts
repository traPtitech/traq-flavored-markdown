import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import { createRenderer } from '@traq-flavored-markdown/core/renderer'
import { file } from 'bun'
import { expect, test } from 'bun:test'

import { parser } from './setup.js'

const fixtures = JSON.parse(
  await file(
    new URL('./fixtures/renderer-corpus-regressions.json', import.meta.url)
  ).text()
)

const view = createRenderer(rendering.createHtmlPreset())

for (const { name, markdown, html } of fixtures)
  test('corpus regression: ' + name, () => {
    expect(view.render(parser.parse(markdown))).toBe(html)
  })
