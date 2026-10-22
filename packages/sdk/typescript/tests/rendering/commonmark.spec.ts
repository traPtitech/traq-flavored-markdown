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

test('URL destinations and labels match markdown-it without normalizing source notation', () => {
  const parser = commonParser()
  const view = html({ validateLink: () => true, validateImage: () => true })
  const expected = new MarkdownIt('commonmark', {
    html: false,
    xhtmlOut: false
  })
  expected.validateLink = () => true
  const hosts = [
    'example.com',
    '日本語.jp',
    'bücher.example',
    'xn--bcher-kva.example',
    'مثال.إختبار',
    '😀.example',
    '[::1]',
    'user:pass@[2001:db8::1]:8080',
    'user:pass@日本語.jp:8080'
  ]
  // JS uppercases reserved escapes in labels; the existing Rust policy retains
  // their spelling, which is covered separately by the native URL tests.
  const paths = [
    '',
    '/',
    '/日本/%20?q=%2F&x=1#片',
    '/a b',
    '/a%zz',
    '/a%2F%25?x=+',
    '/a/../b',
    '/x[0]'
  ]
  try {
    for (const scheme of ['https://', 'http://', '//', 'HTTPS://'])
      for (const host of hosts)
        for (const path of paths) {
          const destination = scheme + host + path
          for (const source of [
            `[x](<${destination}>)`,
            `![x](<${destination}>)`,
            ...(destination.includes(' ') || scheme === '//'
              ? []
              : [`<${destination}>`])
          ])
            expect(view.render(parser.parse(source)), source).toBe(
              expected.render(source)
            )
        }
    for (const destination of [
      '../a/../b?q=%2f#x',
      '?query=%20',
      '#日本',
      'mailto:user@bücher.example?subject=%20',
      'mailto:user@xn--bcher-kva.example',
      'ftp://bücher.example/a',
      'custom:日本/%20',
      'javascript:alert'
    ]) {
      const source = `[x](<${destination}>)`
      expect(view.render(parser.parse(source)), source).toBe(
        expected.render(source)
      )
    }
  } finally {
    parser.dispose()
  }
})
