import { defineNode } from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  createRenderer
} from '@traq-flavored-markdown/core/renderer'
import {
  definitions,
  names,
  schema
} from '@traq-flavored-markdown/traq-plugin/nodes'
import type {
  Reference,
  Stamp
} from '@traq-flavored-markdown/traq-plugin/nodes'
import { expect, test } from 'bun:test'

import { plugin } from '../src/renderer/index.js'
import type { HtmlRendererOptions } from '../src/renderer/types.js'

const view = (options: HtmlRendererOptions = {}) =>
  createRenderer(new PresetBuilder().add(plugin(options)).build(), { schema })
const leaf = (kind: string, data: unknown, source = '') => ({
  source,
  children: [
    {
      kind,
      data,
      span: { start: 0, end: new TextEncoder().encode(source).length }
    }
  ]
})
const stamp = (
  kind: Stamp['kind'],
  effects: Stamp['effects'] = { animations: [], size: 'none' }
): Stamp => ({ kind, effects, literal: ':stamp:' })

test('standalone stamp handlers share resolver, URL and label behavior for names and users', () => {
  const renderer = view({
    resolveStamp: () => ({
      url: 'https://images.test/a"b.png',
      title: '<title>'
    })
  })
  for (const type of ['normal', 'user'] as const) {
    const output = renderer.render(
      leaf(names.Stamp, stamp({ type, name: 'alice' }))
    )
    expect(output).toContain('url(https://images.test/a%22b.png)')
    expect(output).toContain('title=":&lt;title&gt;:"')
    expect(output).toContain(type === 'user' ? ':@alice:' : ':alice:')
  }
  const input = leaf(names.Stamp, stamp({ type: 'normal', name: 'wave' }))
  expect(view().render(input)).toBe(':stamp:')
  expect(
    view({ resolveStamp: () => ({ url: 'javascript:alert(1)' }) }).render(input)
  ).toBe(':stamp:')
})

test('standalone stamp handlers preserve parsed color variants and ordered effects', () => {
  const renderer = view()
  expect(
    renderer.render(
      leaf(names.Stamp, stamp({ type: 'hex_color', rgb: 0x123456 }))
    )
  ).toContain('background-color: #123456;')
  const hsl = stamp(
    { type: 'hsl_color', hue: 20, saturation: 30.5, lightness: 40 },
    { size: 'small', animations: ['conga', 'rotate'] }
  )
  const output = renderer.render(leaf(names.Stamp, hsl))
  expect(output).toContain('emoji-effect conga small')
  expect(output).toContain('emoji-effect rotate')
  expect(output).toContain('background-color: hsl(20, 30.5%, 40%);')
  expect(() =>
    renderer.render(
      leaf(names.Stamp, {
        ...hsl,
        effects: { size: 'small', animations: ['unknown'] }
      })
    )
  ).toThrow(/payload/)
})

test('standalone reference handlers use caller labels and reject unsafe links', () => {
  for (const type of ['user', 'group', 'channel'] as const) {
    const reference: Reference = { type, id: 'identity', label: '<label>' }
    const input = leaf(names.Reference, reference)
    const output = view({
      resolveReference: () => ({ href: '#target', highlight: true })
    }).render(input)
    expect(output).toContain('href="#target"')
    expect(output).toContain('&lt;label&gt;')
    expect(output).toContain('message-' + type + '-link')
    expect(
      view({
        resolveReference: () => ({ href: 'javascript:alert(1)' })
      }).render(input)
    ).toBe('&lt;label&gt;')
  }
})

test('standalone spoiler handlers dispatch validated children and apply overlays', () => {
  const text = defineNode('app.text', () => true, {
    role: 'inline',
    children: { kind: 'leaf' }
  })
  const textPlugin = new RenderPlugin(
    new PluginDeclaration('text')
  ).withHandler(text, (node, ctx) => ctx.sourceSlice(node.span))
  const renderer = createRenderer(
    new PresetBuilder().add(plugin()).add(textPlugin).build(),
    { schema: schema.extend([text]) }
  )
  const child = { kind: text.kind, data: {}, span: { start: 0, end: 1 } }
  const spoiler = {
    kind: definitions.Spoiler.kind,
    data: {},
    children: [child],
    span: { start: 0, end: 1 }
  }
  const document = { source: 'x', children: [spoiler] }
  expect(renderer.render(document)).toBe('<span class="spoiler">x</span>')
  expect(
    renderer.render(document, {
      childText: new Map([[spoiler, '<replacement>']])
    })
  ).toBe('<span class="spoiler">&lt;replacement&gt;</span>')
})
