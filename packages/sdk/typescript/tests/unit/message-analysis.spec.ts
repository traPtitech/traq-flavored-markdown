import type { MutableNode } from '@traq-flavored-markdown/core'
import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { defineNode } from '@traq-flavored-markdown/core'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import type { Document, Node } from '@traq-flavored-markdown/core/renderer'
import { html, messageRenderers } from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import {
  analyzeMessage,
  endsWithResourceCard,
  messageContext
} from '../../messages/analysis.js'

const origin = 'https://q.example.test'
const id = '00000000-0000-0000-0000-000000000001'
const file = `${origin}/files/${id}`
const views = messageRenderers({ origin })

test('empty quote presentation still honors a node-bound child replacement', () => {
  const quote = {
    kind: names.Blockquote,
    data: {},
    span: { start: 0, end: 1 },
    children: []
  }
  expect(
    html().render(
      { source: '>', children: [quote] },
      { childText: new Map([[quote, '<replacement>']]) }
    )
  ).toBe('<blockquote>\n&lt;replacement&gt;</blockquote>\n')
})

test('SDK composes returned built-in values with third-party plugins', () => {
  const original = new RenderPlugin(new Declaration('annotation')).on(
    'annotation',
    () => '<mark>original</mark>'
  )
  const updated = original.replace('annotation', () => '<mark>updated</mark>')
  const source = '*'
  const document: Document = {
    source,
    children: [
      {
        kind: 'annotation',
        data: {},
        span: { start: 0, end: 1 }
      }
    ]
  }
  const customized = html({
    plugins: [updated],
    configurePlugins(plugins) {
      return {
        ...plugins,
        common: plugins.common.replace(names.Text, () => '<b>text</b>')
      }
    }
  })

  expect(customized.render(document)).toBe('<mark>updated</mark>')
  expect(html({ plugins: [original] }).render(document)).toBe(
    '<mark>original</mark>'
  )
  expect(
    customized.render({
      source: 'x',
      children: [
        { kind: names.Text, data: { value: 'x' }, span: { start: 0, end: 1 } }
      ]
    })
  ).toBe('<b>text</b>')
})

test('message preparation includes custom inline roles before validating builtin parents', () => {
  const annotation = defineNode('app.annotation', () => true, {
    role: 'inline',
    children: { kind: 'leaf' }
  })
  const plugin = new RenderPlugin(new Declaration('inline-annotation')).on(
    annotation,
    () => '<mark>custom</mark>'
  )
  const input = {
    source: '',
    children: [
      {
        kind: names.Paragraph,
        data: {},
        span: { start: 0, end: 0 },
        children: [
          { kind: annotation.kind, data: {}, span: { start: 0, end: 0 } }
        ]
      }
    ]
  }
  const rendered = messageRenderers({ origin, plugins: [plugin] }).render(input)
  expect(rendered.standard.renderedText).toBe('<p><mark>custom</mark></p>\n')
  expect(rendered.condensed.renderedText).toBe('<mark>custom</mark>')
})

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
  expect(standard.cards).toEqual([{ type: 'file', id }])
  expect(condensed.cards).toEqual(standard.cards)
  expect(document).toEqual(original)
})

test('rejected links remain visible and do not produce cards', () => {
  const source = `body\n${file}`
  const document: Document = {
    source,
    children: [
      {
        kind: names.Paragraph,
        data: {},
        span: { start: 0, end: source.length },
        children: [
          text('body', 0),
          { kind: names.Softbreak, data: {}, span: { start: 4, end: 5 } },
          link('linkify', file, 5)
        ]
      }
    ]
  }
  const original = structuredClone(document)
  const rejected = messageRenderers({
    origin,
    links: { validate: () => false }
  })

  for (const view of [rejected.standard, rejected.condensed]) {
    const result = view.render(document)
    expect(result.renderedText).toContain(file)
    expect(result.cards).toEqual([])
  }
  expect(endsWithResourceCard(document, origin, () => false)).toBe(false)
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

  const context = messageContext(document)
  const analysis = analyzeMessage(context, origin)
  analysis.childText.set(
    context.node(document.children[0].children![0]),
    '<img src=x>'
  )
  expect(html().createSession(context).render(analysis)).toContain(
    '>&lt;img src=x&gt;</a>'
  )
})

test('both message views share an owned preparation and reject invalid trees before analysis', () => {
  const node = text('before', 0)
  const document = { source: 'before', children: [node] }
  const prepared = views.prepare(document)
  ;(node.data as { value: string }).value = 'after'
  expect(prepared.standard().renderedText).toBe('before')
  expect(prepared.condensed().renderedText).toBe('before')
  expect(views.render(document)).toEqual({
    standard: views.standard.render(document),
    condensed: views.condensed.render(document)
  })
  const cycle: MutableNode = {
    kind: 'custom',
    data: {},
    span: { start: 0, end: 0 },
    children: []
  }
  cycle.children!.push(cycle)
  expect(() =>
    views.standard.render({ source: '', children: [cycle] })
  ).toThrow(/tree/)
})
