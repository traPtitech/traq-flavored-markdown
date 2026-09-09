import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import * as rendering from '@traq-markdown-parser/traq/renderer'
import { renderer } from '@traq-markdown-parser/core/renderer'
import { test } from 'bun:test'

import { parser } from './setup.ts'

const fixtures = JSON.parse(
  await readFile(
    new URL('./fixtures/renderer-corpus-regressions.json', import.meta.url),
    'utf8'
  )
)

const view = renderer(rendering.html())

for (const { name, markdown, html } of fixtures)
  test('corpus regression: ' + name, () => {
    assert.equal(view.render(parser.parse(markdown)), html)
  })
