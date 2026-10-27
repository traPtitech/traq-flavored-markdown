import * as commonNodes from '@traq-flavored-markdown/commonmark-plugin/nodes'
import * as common from '@traq-flavored-markdown/commonmark-plugin/renderer'
import * as html from '@traq-flavored-markdown/core/renderer'
import * as extensions from '@traq-flavored-markdown/extensions-plugin/renderer'
import * as traq from '@traq-flavored-markdown/sdk/renderer'
import * as trapNodes from '@traq-flavored-markdown/traq-plugin/nodes'
import * as trap from '@traq-flavored-markdown/traq-plugin/renderer'
import { createHighlighter } from '@traq-flavored-markdown/commonmark-plugin/highlight'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions as extensionDefinitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { schema as sdkSchema } from '@traq-flavored-markdown/sdk/nodes'
import { expect, test } from 'bun:test'
import MarkdownIt from 'markdown-it'

import { commonParser, parser } from './setup.js'

const build = (plugin: RenderPlugin) =>
  new html.PresetBuilder().add(plugin).build()

test('rendering returns HTML and exposes no parser or token adapter', () => {
  const view = common.createHtmlRenderer()
  expect(view.render(parser.parse('**bold**'))).toBe(
    '<p><strong>bold</strong></p>\n'
  )
  expect(view.render(parser.parseInline('**bold**'))).toBe(
    '<strong>bold</strong>'
  )
  expect(
    html
      .createRenderer(common.createHtmlPreset())
      .render(parser.parseInline('**bold**'))
  ).toBe('<strong>bold</strong>')
  expect(
    html
      .createRenderer(common.createSpecHtmlPreset())
      .render(parser.parseInline('**bold**'))
  ).toBe('<strong>bold</strong>')
  expect(Object.keys(view).sort()).toEqual(['createSession', 'render'])
  expect((html as Record<string, unknown>).installParser).toBeUndefined()
  expect((html as Record<string, unknown>).traqMarkdownIt).toBeUndefined()
})

test('replacement preserves defaults and earlier presets', () => {
  const document = parser.parse('**bold** [link](https://example.com)')
  const plugin = common.plugin()
  const builder = new html.PresetBuilder()
  const registration = builder.register(plugin)
  const before = html.createRenderer(builder.build())
  const updated = plugin.withReplacedHandler(common.nodes.Link, (node, ctx) =>
    ctx.renderChildren()
  )
  builder.remove(registration)
  const custom = html.createRenderer(build(updated))
  expect(custom.render(document)).toMatch(/<strong>bold<\/strong>/)
  expect(custom.render(document)).not.toMatch(/<a /)
  expect(before.render(document)).toMatch(/<a /)
  expect(html.createRenderer(build(plugin)).render(document)).toMatch(/<a /)
  expect(html.createRenderer(builder.build()).render(document)).toBe(
    '**bold** [link](https://example.com)'
  )
  expect(() => plugin.withReplacedHandler('typo', () => '')).toThrow(
    /Missing handler/
  )
  expect(() => plugin.withHandler(common.nodes.Link, () => '')).toThrow(
    /Duplicate handler/
  )
})

test('renderer declarations customize Rust-produced nodes', () => {
  const declaration = Declaration.group('custom').plugin('math')
  const presentation = new html.RenderPlugin(declaration).withHandler(
    extensionDefinitions.InlineMath,
    (node, ctx) => ctx.fallback(node)
  )
  const view = html.createRenderer(
    new html.PresetBuilder().add(common.plugin()).add(presentation).build()
  )
  expect(view.render(parser.parse('$x$'))).toBe('<p>$x$</p>\n')
})

test('SDK html creates a renderer and accepts third-party plugins', () => {
  const annotation = new html.RenderPlugin(
    Declaration.group('external').plugin('annotations')
  ).withHandler(
    'external::annotation',
    (_node, context) => '<mark>' + context.escape('<annotation>') + '</mark>'
  )
  const options = {
    plugins: [annotation],
    configurePlugins(plugins: traq.HtmlPlugins) {
      return {
        ...plugins,
        common: plugins.common.withReplacedHandler(
          commonNodes.names.Strong,
          (node, context) => '<b>' + context.renderChildren() + '</b>'
        )
      }
    }
  }
  const view = traq.createHtmlRenderer(options)
  expect(Object.keys(view)).toEqual(['createSession', 'render'])
  expect(view.render(parser.parseInline('**bold**'))).toBe('<b>bold</b>')

  const document = {
    source: '<annotation>',
    children: [
      {
        kind: 'external::annotation',
        data: {},
        span: { start: 0, end: 12 }
      }
    ]
  }
  expect(view.render(document)).toBe('<mark>&lt;annotation&gt;</mark>')
  expect(
    html
      .createRenderer(traq.createHtmlPreset(options), {
        schema: sdkSchema.withUnknownNodes()
      })
      .render(document)
  ).toBe('<mark>&lt;annotation&gt;</mark>')
  expect(
    traq
      .messageRenderers({
        origin: 'https://q.example.test',
        plugins: [annotation]
      })
      .standard.render(document).html
  ).toBe('<mark>&lt;annotation&gt;</mark>')
})

test('composition validates selected names without changing earlier presets', () => {
  const group = Declaration.group('custom')
  const first = new html.RenderPlugin(group.plugin('one')).withHandler(
    'a',
    () => ''
  )
  const builder = new html.PresetBuilder()
  const registration = builder.register(first)
  const preset = builder.build()
  expect(() => builder.add(first)).toThrow(/Duplicate plugin/)
  expect(() =>
    builder.add(
      new html.RenderPlugin(group.plugin('two')).withHandler('a', () => '')
    )
  ).toThrow(/Duplicate handler/)
  builder.remove(registration)
  expect(() => html.createRenderer(preset)).not.toThrow()
  expect(() => builder.remove(registration)).toThrow(/Missing registration/)
  builder.add(first).add(new html.RenderPlugin(group.plugin('one')))
  expect(() => builder.build()).toThrow(/Duplicate name/)
  const other = Declaration.group('custom')
  expect(() =>
    new html.PresetBuilder()
      .add(first)
      .add(new html.RenderPlugin(other.plugin('different')))
      .build()
  ).toThrow(/Duplicate name/)
  expect(() => html.createRenderer({} as never)).toThrow(/Expected HTML preset/)
  expect(() => new html.RenderPlugin('name' as never)).toThrow(/declaration/)
})

test('custom HTML handlers receive escaped text helpers and rendered children', () => {
  const plugin = common.plugin({ rawHtml: 'escape' })
  const customized = plugin.withReplacedHandler(
    common.nodes.Strong,
    (node, context) =>
      '<b title="' +
      context.escape('"<&') +
      '">' +
      context.renderChildren() +
      '</b>'
  )
  const view = html.createRenderer(build(customized))
  expect(view.render(parser.parseInline('**<x>**'))).toBe(
    '<b title="&quot;&lt;&amp;">&lt;x&gt;</b>'
  )
  const invalid = customized.withReplacedHandler(
    common.nodes.Strong,
    () => [] as unknown as string
  )
  expect(() =>
    html.createRenderer(build(invalid)).render(parser.parse('**x**'))
  ).toThrow(/HTML strings/)
  expect(view.render(parser.parseInline('**x**'))).toContain('<b')
})

test('fallback replacement keeps other extensions and does not require a store', () => {
  const extension = trap
    .plugin()
    .withReplacedHandler(trapNodes.names.Stamp, (node, ctx) =>
      ctx.fallback(node)
    )
  const view = html.createRenderer(
    new html.PresetBuilder()
      .add(common.plugin())
      .add(extensions.plugin())
      .add(extension)
      .build()
  )
  expect(view.render(parser.parse(':stamp: ==marked=='))).toBe(
    '<p>:stamp: <mark>marked</mark></p>\n'
  )
  const source = '!{"type":"user","id":"u","raw":"@user"}'
  expect(
    html.createRenderer(traq.createHtmlPreset()).render(parser.parse(source))
  ).toBe('<p>@user</p>\n')
})

test('empty presets escape source without implicitly enabling CommonMark', () => {
  const view = html.createRenderer(new html.PresetBuilder().build())
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
    const view = common.createHtmlRenderer()
    for (const source of [
      '- one\n- two',
      '- one\n\n- two',
      '- outer\n  - inner\n\n  - loose',
      '- outer\n  > quote',
      '1. parent\n   - child\n     > quote',
      '- **strong**\n\n  paragraph',
      '> - parent\n    - child',
      '> - 親\r\n\t- 子',
      '> - parent\n    1. child',
      '> - parent\n>   - child',
      '> paragraph\n7. item\nnext',
      '> paragraph\n> 7. item',
      'paragraph\n7. item',
      '- example\n  ```\n  code\n  ```\n  explanation',
      '- example\n  ```\n  code\n  ```\n\n  explanation',
      '1. parent\n   - first\n   - example\n     ```\n     code\n     ```\n     explanation\n\n2. next',
      '- parent\n  - child\n   ```\n   code\n  ```\n  explanation',
      '- parent\n  - child\n\n  explanation'
    ]) {
      expect(view.render(local.parse(source))).toBe(md.render(source))
    }
  } finally {
    local.dispose()
  }
})

test('CommonMark owns link policy and rejects malformed known payloads', () => {
  const view = common.createHtmlRenderer({ validateLink: () => false })
  expect(view.render(parser.parse('[link](https://example.com)'))).toBe(
    '<p>[link](https://example.com)</p>\n'
  )
  expect(view.render(parser.parseInline('[link](https://example.com)'))).toBe(
    '[link](https://example.com)'
  )
  const document = parser
    .parseInline('[label](https://example.com)')
    .toMutable()
  ;(document.children[0].data as { destination: string }).destination =
    'javascript:alert(1)'
  expect(common.createHtmlRenderer().render(document)).toBe(
    '[label](https://example.com)'
  )
  const heading = parser.parse('# title').toMutable()
  expect(heading.children[0].kind).toBe(commonNodes.names.Heading)
  Object.assign(heading.children[0].data, { level: '1 onclick="alert(1)"' })
  expect(() => common.createHtmlRenderer().render(heading)).toThrow(
    /Invalid node payload/
  )
})

test('default link policy allows communication and location schemes while preserving rejected source', () => {
  const view = common.createHtmlRenderer()
  const commonmark = commonParser()
  try {
    for (const source of [
      '[電話](tel:+819012345678)',
      '[SMS](sms:+819012345678)',
      '[位置](geo:35.6812,139.7671)'
    ]) {
      expect(view.render(commonmark.parseInline(source))).toMatch(/^<a href=/)
    }

    expect(view.render(commonmark.parseInline('<hoge:hoge>'))).toBe(
      '&lt;hoge:hoge&gt;'
    )
    expect(view.render(commonmark.parseInline('日本語 <hoge:a&b>'))).toBe(
      '日本語 &lt;hoge:a&amp;b&gt;'
    )
    expect(view.render(commonmark.parseInline('[説明](hoge:target)'))).toBe(
      '[説明](hoge:target)'
    )
    expect(view.render(commonmark.parseInline('[x](javascript:alert)'))).toBe(
      '[x](javascript:alert)'
    )
    expect(view.render(commonmark.parseInline('![x](tel:+819012345678)'))).toBe(
      '!<a href="tel:+819012345678">x</a>'
    )
  } finally {
    commonmark.dispose()
  }
})

test('direct HTML rendering escapes attributes, image text, and fence info', () => {
  const parser = commonParser()
  const view = common.createHtmlRenderer({ linkAttributes: { title: '"<&' } })
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
  const extended = html.createRenderer(
    traq.createHtmlPreset({ images: { validate: () => true } })
  )
  expect(extended.render(parser.parseInline('![日本語](/image)'))).toBe(
    '<img src="/image" alt="日本語">'
  )
})

test('highlighting escapes a custom pre class attribute', () => {
  expect(
    createHighlighter({ preClass: 'code" data-x="value' })('<&', 'text')
  ).toEqual({
    kind: 'block',
    html: '<pre class="code&quot; data-x=&quot;value"><code class="lang-text">&lt;&amp;</code></pre>'
  })
})

test('highlight results explicitly choose code content or a complete block', () => {
  const document = parser.parse('```text\nsource\n```')
  const content = common.createHtmlRenderer({
    highlight: () => ({ kind: 'content', html: '<prelude>highlight</prelude>' })
  })
  expect(content.render(document)).toBe(
    '<pre><code class="language-text"><prelude>highlight</prelude></code></pre>\n'
  )

  const block = common.createHtmlRenderer({
    highlight: () => ({ kind: 'block', html: '<pre>custom</pre>' })
  })
  expect(block.render(document)).toBe('<pre>custom</pre>\n')
})
