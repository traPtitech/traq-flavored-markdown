import * as generic from '@traq-markdown-parser/commonmark/generic/renderer'
import * as commonNodes from '@traq-markdown-parser/commonmark/nodes'
import * as common from '@traq-markdown-parser/commonmark/renderer'
import * as html from '@traq-markdown-parser/core/renderer'
import * as trapNodes from '@traq-markdown-parser/trap-extension/nodes'
import * as trap from '@traq-markdown-parser/trap-extension/renderer'
import * as traq from '@traq-markdown-parser/traq/renderer'
import { Plugin as Declaration } from '@traq-markdown-parser/core/definitions'
import type { Plugin } from '@traq-markdown-parser/core/renderer'
import { expect, test } from 'bun:test'
import MarkdownIt from 'markdown-it'

import { commonParser, parser } from './setup.ts'

const build = (plugin: Plugin) => new html.PresetBuilder().add(plugin).build()

test('rendering returns HTML and exposes no parser or token adapter', () => {
  const view = html.renderer(common.preset())
  expect(view.render(parser.parse('**bold**'))).toBe(
    '<p><strong>bold</strong></p>\n'
  )
  expect(view.render(parser.parseInline('**bold**'))).toBe(
    '<strong>bold</strong>'
  )
  expect(Object.keys(view).sort()).toEqual(['render'])
  expect((html as Record<string, unknown>).installParser).toBeUndefined()
  expect((html as Record<string, unknown>).traQMarkdownIt).toBeUndefined()
})

test('replacement preserves defaults and earlier snapshots', () => {
  const document = parser.parse('**bold** [link](https://example.com)')
  const plugin = common.html.plugin()
  const builder = new html.PresetBuilder().add(plugin)
  const before = html.renderer(builder.build())
  plugin.replace(common.nodes.Link, (node, ctx) => ctx.render(node.children))
  expect(() => builder.remove(plugin)).toThrow(/Missing plugin/)
  const custom = html.renderer(build(plugin))
  expect(custom.render(document)).toMatch(/<strong>bold<\/strong>/)
  expect(custom.render(document)).not.toMatch(/<a /)
  expect(before.render(document)).toMatch(/<a /)
  expect(html.renderer(builder.build()).render(document)).toMatch(/<a /)
  expect(() => plugin.replace('typo', () => '')).toThrow(/Missing handler/)
  expect(() => plugin.on(common.nodes.Link, () => '')).toThrow(
    /Duplicate handler/
  )
})

test('renderer declarations customize Rust-produced nodes', () => {
  const declaration = Declaration.group('custom').new('math')
  const presentation = new html.Plugin(declaration).on(
    'markdown_generic_contracts::math::InlineMathData',
    (node, ctx) => ctx.fallback(node)
  )
  const view = html.renderer(
    new html.PresetBuilder().add(common.plugin()).add(presentation).build()
  )
  expect(view.render(parser.parse('$x$'))).toBe('<p>$x$</p>\n')
})

test('composition validates selected names without changing earlier presets', () => {
  const group = Declaration.group('custom')
  const first = new html.Plugin(group.new('one')).on('a', () => '')
  const builder = new html.PresetBuilder().add(first)
  const preset = builder.build()
  expect(() => builder.add(first)).toThrow(/Duplicate plugin/)
  expect(() =>
    builder.add(new html.Plugin(group.new('two')).on('a', () => ''))
  ).toThrow(/Duplicate handler/)
  builder.remove(first)
  expect(() => html.renderer(preset)).not.toThrow()
  expect(() => builder.remove(first)).toThrow(/Missing plugin/)
  builder.add(first).add(new html.Plugin(group.new('one')))
  expect(() => builder.build()).toThrow(/Duplicate name/)
  const other = Declaration.group('custom')
  expect(() =>
    new html.PresetBuilder()
      .add(first)
      .add(new html.Plugin(other.new('different')))
      .build()
  ).toThrow(/Duplicate name/)
  expect(() => html.renderer({} as never)).toThrow(/Expected renderer Preset/)
  expect(() => new html.Plugin('name' as never)).toThrow(/declaration/)
})

test('custom HTML handlers receive escaped text helpers and rendered children', () => {
  const plugin = common.plugin()
  plugin.replace(
    common.nodes.Strong,
    (node, context) =>
      '<b title="' +
      context.escape('"<&') +
      '">' +
      context.render(node.children) +
      '</b>'
  )
  const view = html.renderer(build(plugin))
  expect(view.render(parser.parseInline('**<x>**'))).toBe(
    '<b title="&quot;&lt;&amp;">&lt;x&gt;</b>'
  )
  plugin.replace(common.nodes.Strong, () => [] as unknown as string)
  expect(() =>
    html.renderer(build(plugin)).render(parser.parse('**x**'))
  ).toThrow(/HTML strings/)
})

test('fallback replacement keeps other extensions and does not require a store', () => {
  const extension = trap.plugin()
  extension.replace(trapNodes.names.Stamp, (node, ctx) => ctx.fallback(node))
  const view = html.renderer(
    new html.PresetBuilder()
      .add(common.plugin())
      .add(generic.plugin())
      .add(extension)
      .build()
  )
  expect(view.render(parser.parse(':stamp: ==marked=='))).toBe(
    '<p>:stamp: <mark>marked</mark></p>\n'
  )
  const source = '!{"type":"user","id":"u","raw":"@user"}'
  expect(html.renderer(traq.html()).render(parser.parse(source))).toBe(
    '<p>@user</p>\n'
  )
})

test('empty presets escape source without implicitly enabling CommonMark', () => {
  const view = html.renderer(new html.PresetBuilder().build())
  expect(view.render(parser.parse('**bold**'))).toBe('**bold**')
  const source = '<script>日本語</script>'
  const document = {
    source,
    children: [
      {
        kind: 'unknown',
        data: {},
        span: { start: 0, end: new TextEncoder().encode(source).length }
      }
    ]
  }
  expect(view.render(document)).toBe('&lt;script&gt;日本語&lt;/script&gt;')
})

test('tight lists preserve paragraphs owned by blockquotes and nested loose lists', () => {
  const md = new MarkdownIt()
  const local = commonParser()
  try {
    const view = html.renderer(common.preset())
    for (const source of [
      '- one\n- two',
      '- one\n\n- two',
      '- outer\n  - inner\n\n  - loose',
      '- outer\n  > quote',
      '1. parent\n   - child\n     > quote',
      '- **strong**\n\n  paragraph'
    ]) {
      expect(view.render(local.parse(source))).toBe(md.render(source))
    }
  } finally {
    local.dispose()
  }
})

test('CommonMark owns link policy and rejects malformed known payloads', () => {
  const view = html.renderer(common.preset({ validateLink: () => false }))
  expect(view.render(parser.parse('[link](https://example.com)'))).not.toMatch(
    /href=/
  )
  expect(
    view.render(parser.parseInline('[link](https://example.com)'))
  ).not.toMatch(/href=/)
  const document = parser.parseInline('[label](https://example.com)')
  ;(document.children[0].data as { destination: string }).destination =
    'javascript:alert(1)'
  expect(html.renderer(common.preset()).render(document)).toBe('label')
  const heading = parser.parse('# title')
  expect(heading.children[0].kind).toBe(commonNodes.names.Heading)
  ;(heading.children[0].data as { level: string }).level =
    '1 onclick="alert(1)"'
  expect(() => html.renderer(common.preset()).render(heading)).toThrow(
    /Invalid render payload/
  )
})

test('direct HTML rendering escapes attributes, image text, and fence info', () => {
  const parser = commonParser()
  const view = html.renderer(
    common.preset({ linkAttributes: { title: '"<&' } })
  )
  expect(view.render(parser.parseInline('[x](/url)'))).toBe(
    '<a href="/url" title="&quot;&lt;&amp;">x</a>'
  )
  expect(() =>
    common.plugin({ linkAttributes: { 'x onclick': 'bad' } })
  ).toThrow(/Invalid HTML attribute/)
  expect(
    view.render(parser.parseInline('![**bold** `code` &quot;](/image)'))
  ).toBe('<img src="/image" alt="bold code &quot;">')
  expect(view.render(parser.parse('```a\\+b&quot;\n<&\n```'))).toBe(
    '<pre><code class="language-a+b&quot;">&lt;&amp;\n</code></pre>\n'
  )
  const extended = html.renderer(traq.html({ validateImage: () => true }))
  expect(extended.render(parser.parseInline('![日本語](/image)'))).toBe(
    '<img src="/image" alt="日本語">'
  )
})
