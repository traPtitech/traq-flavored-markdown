import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  createRenderer
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

test('plugins are immutable values and presets retain the selected version', () => {
  const declaration = new Declaration('custom')
  const plugin = new RenderPlugin(declaration).withHandler('text', (n, c) =>
    c.escape(n.data as string)
  )
  const builder = new PresetBuilder()
  const registration = builder.register(plugin)
  const view = createRenderer(builder.build())
  const document = {
    source: '<猫>',
    children: [{ kind: 'text', data: '<猫>', span: { start: 0, end: 5 } }]
  }
  expect(view.render(document)).toBe('&lt;猫&gt;')
  const updated = plugin.withReplacedHandler('text', () => '<b>changed</b>')
  expect(updated).not.toBe(plugin)
  expect(view.render(document)).toBe('&lt;猫&gt;')
  expect(createRenderer(builder.build()).render(document)).toBe('&lt;猫&gt;')
  expect(
    createRenderer(new PresetBuilder().add(plugin).build()).render(document)
  ).toBe('&lt;猫&gt;')
  expect(() => builder.add(plugin)).toThrow(/Duplicate plugin/)
  expect(() => builder.add(updated)).toThrow(/Duplicate plugin/)
  builder.remove(registration)
  expect(createRenderer(builder.build()).render(document)).toBe('&lt;猫&gt;')
  const nextRegistration = builder.register(updated)
  expect(createRenderer(builder.build()).render(document)).toBe(
    '<b>changed</b>'
  )
  builder.remove(nextRegistration)
  expect(createRenderer(builder.build()).render(document)).toBe('&lt;猫&gt;')
  expect(view.render(document)).toBe('&lt;猫&gt;')
  expect(createRenderer(new PresetBuilder().build()).render(document)).toBe(
    '&lt;猫&gt;'
  )
  expect(() => new PresetBuilder().add(plugin).add(plugin)).toThrow(
    /Duplicate plugin/
  )
})

test('fallback and child rendering have no block or inline mode', () => {
  const declaration = new Declaration('containers')
  const plugin = new RenderPlugin(declaration)
    .withHandler('container', (node, ctx) => {
      expect('inline' in ctx).toBeFalse()
      expect('blocks' in ctx).toBeFalse()
      return ctx.renderChildren()
    })
    .withHandler('explicit', (node, ctx) => ctx.fallback(node))
  const builder = new PresetBuilder().add(plugin)
  const options = { fallback: (text: string) => `<aside>${text}</aside>` }
  const custom = createRenderer(builder.build(options))
  options.fallback = () => 'changed'
  const plain = createRenderer(builder.build())
  const leaf = { kind: 'unknown', data: {}, span: { start: 0, end: 5 } }
  const document = { source: '<猫>', children: [leaf] }
  for (const view of [plain, custom]) {
    expect(Object.keys(view)).toEqual(['createSession', 'render'])
  }
  for (const kind of ['unknown', 'explicit', 'container']) {
    const input = {
      ...document,
      children: [{ ...leaf, kind, children: [leaf] }]
    }
    expect(plain.render(input)).toBe('&lt;猫&gt;')
    expect(custom.render(input)).toBe('<aside>&lt;猫&gt;</aside>')
  }
  // @ts-expect-error This verifies that invalid fallback values are rejected at runtime.
  expect(() => builder.build({ fallback: 42 })).toThrow(
    /Expected render fallback/
  )
  expect(() =>
    createRenderer(
      builder.build({ fallback: () => [] as unknown as string })
    ).render(document)
  ).toThrow(/HTML string/)
})

test('render overlays select roots, omit nodes, and escape replacement child text', () => {
  const plugin = new RenderPlugin(new Declaration('overlay'))
    .withHandler(
      'container',
      (node, context) => '<p>' + context.renderChildren() + '</p>'
    )
    .withHandler('copied', (node, context) => context.renderChildren())
    .withHandler('text', node => String(node.data))
  const view = createRenderer(new PresetBuilder().add(plugin).build())
  const first = { kind: 'text', data: 'first', span: { start: 0, end: 0 } }
  const second = { kind: 'text', data: 'second', span: { start: 0, end: 0 } }
  const container = {
    kind: 'container',
    data: {},
    span: { start: 0, end: 0 },
    children: [first, second]
  }
  const document = { source: '', children: [container, { ...second }] }

  expect(view.render(document)).toBe('<p>firstsecond</p>second')
  expect(
    view.render(document, {
      roots: [container],
      omittedNodes: new Set([second])
    })
  ).toBe('<p>first</p>')
  expect(
    view.render(document, {
      roots: [container],
      childText: new Map([[container, '<b>&']])
    })
  ).toBe('<p>&lt;b&gt;&amp;</p>')
  const copied = { ...container, kind: 'copied' }
  expect(
    view.render(
      { source: '', children: [copied] },
      { childText: new Map([[copied, 'replacement']]) }
    )
  ).toBe('replacement')
  expect(view.render(document)).toBe('<p>firstsecond</p>second')
})

test('renderer rejects invalid UTF-8 spans throughout the document', () => {
  const view = createRenderer(new PresetBuilder().build())
  const valid = {
    source: '猫x',
    children: [
      { kind: 'unknown', data: null, span: { start: 0, end: 3 } },
      { kind: 'unknown', data: null, span: { start: 3, end: 4 } }
    ]
  }
  expect(view.render(valid)).toBe('猫x')

  const middleOfCharacter = structuredClone(valid)
  middleOfCharacter.children[0].span.end = 1
  const outsideSource = structuredClone(valid)
  outsideSource.children[1].span.end = 5
  const reversed = structuredClone(valid)
  reversed.children.reverse()
  for (const document of [middleOfCharacter, outsideSource, reversed])
    expect(() => view.render(document)).toThrow(/Invalid document span/)

  const omitted = structuredClone(outsideSource)
  expect(() =>
    view.render(omitted, { omittedNodes: new Set([omitted.children[1]]) })
  ).toThrow(/Invalid document span/)
})
