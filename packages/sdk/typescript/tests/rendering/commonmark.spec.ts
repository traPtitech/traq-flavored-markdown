import { html } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'
import { file } from 'bun'
import { expect, test } from 'bun:test'
import MarkdownIt from 'markdown-it'

import { commonParser } from './setup.ts'

const fixtures = JSON.parse(
  await file(
    new URL(
      '../../../../../tests/fixtures/commonmark-0.31.2.json',
      import.meta.url
    )
  ).text()
)

test('CommonMark fixture inputs match markdown-it with the same escaped-HTML policy', () => {
  const parser = commonParser()
  const view = renderer(
    html({ validateLink: () => true, validateImage: () => true })
  )
  const expected = new MarkdownIt('commonmark', { html: true, xhtmlOut: false })
  expected.validateLink = () => true
  expected.renderer.rules.html_inline = (tokens, index) =>
    expected.utils.escapeHtml(tokens[index].content)
  expected.renderer.rules.html_block = (tokens, index) =>
    '<p>' + expected.utils.escapeHtml(tokens[index].content) + '</p>\n'
  try {
    for (const entry of fixtures)
      expect(view.render(parser.parse(entry.markdown))).toBe(
        expected.render(entry.markdown)
      )
  } finally {
    parser.dispose()
  }
})
