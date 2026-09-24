import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { Document, Node } from '@traq-flavored-markdown/core/renderer'
import { html, messageRenderers } from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import { analyzeMessage } from '../../renderer/embeddings.js'

const origin = 'https://q.example.test'
const id = '00000000-0000-0000-0000-000000000001'
const file = `${origin}/files/${id}`
const views = messageRenderers({ origin })

function text(value: string, start: number): Node {
  return {
    kind: names.Text,
    data: { value },
    span: { start, end: start + value.length }
  }
}

function link(
  form: 'explicit' | 'linkify',
  label: string,
  start: number
): Node {
  return {
    kind: names.Link,
    data: { destination: file, title: null, form },
    span: { start, end: start + label.length },
    children: [text(label, start)]
  }
}

test('message analysis suppresses trailing cards without changing the AST', () => {
  const source = `body\n${file}`
  const paragraph: Node = {
    kind: names.Paragraph,
    data: {},
    span: { start: 0, end: source.length },
    children: [
      text('body', 0),
      { kind: names.Softbreak, data: {}, span: { start: 4, end: 5 } },
      link('linkify', file, 5)
    ]
  }
  const document: Document = { source, children: [paragraph] }
  const original = structuredClone(document)

  const standard = views.standard.render(document)
  const condensed = views.condensed.render(document)
  expect(standard.renderedText).toBe('<p>body</p>\n')
  expect(condensed.renderedText).toBe('body')
  expect(standard.embeddings).toEqual([{ type: 'file', id }])
  expect(condensed.embeddings).toEqual(standard.embeddings)
  expect(document).toEqual(original)
})

test('condensed labels come from an overlay while explicit links retain markup', () => {
  const source = `[file](${file})`
  const document: Document = {
    source,
    children: [
      {
        kind: names.Paragraph,
        data: {},
        span: { start: 0, end: source.length },
        children: [link('explicit', 'file', 0)]
      }
    ]
  }
  const standard = views.standard.render(document).renderedText
  const condensed = views.condensed.render(document).renderedText
  expect(standard).toContain('>file</a>')
  expect(condensed).toContain('>[[添付ファイル]]</a>')
  expect(condensed).not.toContain('>file</a>')

  const analysis = analyzeMessage(document, origin)
  analysis.childText.set(document.children[0].children![0], '<img src=x>')
  expect(html().render(document, analysis)).toContain('>&lt;img src=x&gt;</a>')
})
