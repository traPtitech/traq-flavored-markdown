import { Plugin as Declaration } from '@traq-flavored-markdown/core/definitions'
import {
  Plugin,
  PresetBuilder,
  renderer
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

test('core renders custom AST nodes without a grammar or Wasm runtime', () => {
  const declaration = new Declaration('custom')
  const plugin = new Plugin(declaration).on('text', (n, c) =>
    c.escape(n.data as string)
  )
  const builder = new PresetBuilder().add(plugin)
  const view = renderer(builder.build())
  const document = {
    source: '<猫>',
    children: [{ kind: 'text', data: '<猫>', span: { start: 0, end: 5 } }]
  }
  expect(view.render(document)).toBe('&lt;猫&gt;')
  plugin.replace('text', () => '<b>changed</b>')
  expect(view.render(document)).toBe('&lt;猫&gt;')
  expect(renderer(builder.build()).render(document)).toBe('&lt;猫&gt;')
  expect(() => builder.add(plugin)).toThrow(/Duplicate plugin/)
  builder.remove(plugin)
  expect(renderer(builder.build()).render(document)).toBe('&lt;猫&gt;')
  builder.add(plugin)
  expect(renderer(builder.build()).render(document)).toBe('<b>changed</b>')
  expect(renderer(new PresetBuilder().build()).render(document)).toBe(
    '&lt;猫&gt;'
  )
  expect(() => new PresetBuilder().add(plugin).add(plugin)).toThrow(
    /Duplicate plugin/
  )
})

test('fallback and child rendering have no block or inline mode', () => {
  const declaration = new Declaration('containers')
  const plugin = new Plugin(declaration)
    .on('container', (node, ctx) => {
      expect('inline' in ctx).toBeFalse()
      expect('blocks' in ctx).toBeFalse()
      return ctx.render(node.children)
    })
    .on('explicit', (node, ctx) => ctx.fallback(node))
  const builder = new PresetBuilder().add(plugin)
  const options = { fallback: (text: string) => `<aside>${text}</aside>` }
  const custom = renderer(builder.build(options))
  options.fallback = () => 'changed'
  const plain = renderer(builder.build())
  const leaf = { kind: 'unknown', data: {}, span: { start: 0, end: 5 } }
  const document = { source: '<猫>', children: [leaf] }
  for (const view of [plain, custom]) {
    expect(Object.keys(view)).toEqual(['render'])
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
    renderer(builder.build({ fallback: () => [] as unknown as string })).render(
      document
    )
  ).toThrow(/HTML string/)
})

test('render overlays select roots, omit nodes, and escape replacement child text', () => {
  const plugin = new Plugin(new Declaration('overlay'))
    .on(
      'container',
      (node, context) => '<p>' + context.render(node.children) + '</p>'
    )
    .on('copied', (node, context) => context.render([...(node.children ?? [])]))
    .on('text', node => String(node.data))
  const view = renderer(new PresetBuilder().add(plugin).build())
  const first = { kind: 'text', data: 'first', span: { start: 0, end: 0 } }
  const second = { kind: 'text', data: 'second', span: { start: 0, end: 0 } }
  const container = {
    kind: 'container',
    data: {},
    span: { start: 0, end: 0 },
    children: [first, second]
  }
  const document = { source: '', children: [container, second] }

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
  ).toBe('firstsecond')
  expect(view.render(document)).toBe('<p>firstsecond</p>second')
})
