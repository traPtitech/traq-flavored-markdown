import {
  html,
  specHtml
} from '@traq-flavored-markdown/commonmark-plugin/renderer'
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

test('CommonMark specification examples render with the specification HTML renderer', () => {
  const parser = commonParser()
  const view = specHtml()
  try {
    for (const entry of fixtures)
      expect(
        view.render(parser.parse(entry.markdown)),
        `example ${entry.example}`
      ).toBe(entry.html)
  } finally {
    parser.dispose()
  }
})

test('CommonMark fixture inputs match markdown-it with the same escaped-HTML policy', () => {
  const parser = commonParser()
  const view = html({ validateLink: () => true, validateImage: () => true })
  const expected = new MarkdownIt('commonmark', { html: true, xhtmlOut: false })
  expected.validateLink = () => true
  expected.renderer.rules.html_inline = (tokens, index) =>
    expected.utils.escapeHtml(tokens[index].content)
  expected.renderer.rules.html_block = (tokens, index) =>
    '<p>' + expected.utils.escapeHtml(tokens[index].content) + '</p>\n'
  try {
    for (const entry of fixtures) {
      // markdown-it omits the newline inside empty blockquotes, unlike the spec.
      const expectedHtml = expected
        .render(entry.markdown)
        .replaceAll(
          '<blockquote></blockquote>\n',
          '<blockquote>\n</blockquote>\n'
        )
      expect(view.render(parser.parse(entry.markdown))).toBe(expectedHtml)
    }
  } finally {
    parser.dispose()
  }
})
