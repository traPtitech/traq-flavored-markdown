import type { Document, Node } from '@traq-flavored-markdown/core'
import { expect, test } from 'bun:test'

import { names } from '../src/generated/commonmark.js'
import { html } from '../src/renderer/index.js'

test('empty highlighted HTML is explicit while undefined selects escaped source', () => {
  const document = {
    source: 'source',
    children: [
      {
        kind: names.CodeBlock,
        data: { fenced: true, info: 'text', literal: 'source' },
        span: { start: 0, end: 6 }
      }
    ]
  }
  expect(
    html({ highlight: () => ({ kind: 'content', html: '' }) }).render(document)
  ).toBe('<pre><code class="language-text"></code></pre>\n')
  expect(
    html({ highlight: () => ({ kind: 'block', html: '' }) }).render(document)
  ).toBe('\n')
  expect(html({ highlight: () => undefined }).render(document)).toContain(
    'source'
  )
})

test('display defaults resolve undefined before HTML and link handlers run', () => {
  const source = '<script>evil()</script>'
  const raw = {
    source,
    children: [
      {
        kind: names.HtmlInline,
        data: { literal: source },
        span: { start: 0, end: source.length }
      }
    ]
  }
  expect(html({ rawHtml: undefined }).render(raw)).toBe(
    '&lt;script&gt;evil()&lt;/script&gt;'
  )
  const unsafe = {
    source: '[x](javascript:x)',
    children: [
      {
        kind: names.Link,
        data: { destination: 'javascript:x', title: null, form: 'explicit' },
        span: { start: 0, end: 17 }
      }
    ]
  }
  expect(html({ validateLink: undefined }).render(unsafe)).toBe(
    '[x](javascript:x)'
  )
})

test('list layout uses visible children and applies item replacement through renderChildren', () => {
  const text = (start: number): Node => ({
    kind: names.Text,
    data: { value: start ? 'b' : 'a' },
    span: { start, end: start + 1 }
  })
  const paragraph = (start: number): Node => ({
    kind: names.Paragraph,
    data: {},
    span: { start, end: start + 1 },
    children: [text(start)]
  })
  const first: Node = {
    kind: names.ListItem,
    data: {},
    span: { start: 0, end: 1 },
    children: [paragraph(0)]
  }
  const second: Node = {
    kind: names.ListItem,
    data: {},
    span: { start: 1, end: 2 },
    children: [paragraph(1)]
  }
  const document: Document = {
    source: 'ab',
    children: [
      {
        kind: names.List,
        data: {
          kind: { type: 'ordered', start: 3, delimiter: 'parenthesis' },
          tight: true
        },
        span: { start: 0, end: 2 },
        children: [first, second]
      }
    ]
  }
  const view = html()
  expect(view.render(document)).toBe(
    '<ol start="3">\n<li>a</li>\n<li>b</li>\n</ol>\n'
  )
  expect(
    view.render(document, {
      omittedNodes: new Set([first]),
      childText: new Map([[second, '<replacement>']])
    })
  ).toBe('<ol start="3">\n<li>&lt;replacement&gt;</li>\n</ol>\n')
})
