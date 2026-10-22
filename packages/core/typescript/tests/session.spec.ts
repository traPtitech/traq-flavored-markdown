import {
  DocumentContext,
  defineNode,
  documentLimits
} from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  renderer
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

import type { MutableNode } from '../ast.js'

test('every render plan node must belong to the validated document before any handler runs', () => {
  let calls = 0
  const plugin = new RenderPlugin(new PluginDeclaration('plan')).on(
    'text',
    () => {
      calls++
      return 'text'
    }
  )
  const view = renderer(new PresetBuilder().add(plugin).build())
  const node = { kind: 'text', data: {}, span: { start: 0, end: 3 } }
  const document = { source: 'abc', children: [node] }
  const foreign = { ...node, span: { start: -1, end: 100 } }
  for (const plan of [
    { roots: [foreign] },
    { omittedNodes: new Set([foreign]) },
    { childText: new Map([[foreign, 'replacement']]) }
  ])
    expect(() => view.render(document, plan)).toThrow(/does not belong/)
  expect(calls).toBe(0)
})

test('node definitions infer payload types and validate known nodes before dispatch or omission', () => {
  let validations = 0
  const text = defineNode<{ kind: 'text'; data: { value: string } }>(
    'text',
    value => {
      validations++
      return (
        !!value &&
        typeof value === 'object' &&
        'value' in value &&
        typeof value.value === 'string'
      )
    }
  )
  let calls = 0
  const plugin = new RenderPlugin(new PluginDeclaration('typed')).on(
    text,
    (node, ctx) => {
      calls++
      return ctx.escape(node.data.value)
    }
  )
  const view = renderer(new PresetBuilder().add(plugin).build())
  const node = {
    kind: 'text',
    data: { value: '<猫>' },
    span: { start: 0, end: 0 }
  }
  const document = { source: '', children: [node] }
  const session = view.createSession(document)
  expect(session.render()).toBe('&lt;猫&gt;')
  expect(view.createSession(session.context).render()).toBe('&lt;猫&gt;')
  expect(validations).toBe(1)
  node.data.value = 'edited'
  expect(session.render()).toBe('&lt;猫&gt;')
  expect(view.render(document)).toBe('edited')
  const malformed = { ...node, data: { value: 42 } }
  const before = calls
  expect(() =>
    view.render(
      { source: '', children: [malformed] },
      { omittedNodes: new Set([malformed]) }
    )
  ).toThrow(/Invalid render payload/)
  expect(calls).toBe(before)
})

test('sessions retain document ancestry and node-bound child replacement', () => {
  const seen: string[][] = []
  const plugin = new RenderPlugin(new PluginDeclaration('tree'))
    .on('container', (_node, ctx) => '[' + ctx.renderChildren() + ']')
    .on('text', (_node, ctx) => {
      seen.push(ctx.ancestors.map(parent => parent.kind))
      return String(ctx.index)
    })
  const child = { kind: 'text', data: {}, span: { start: 0, end: 0 } }
  const parent = {
    kind: 'container',
    data: {},
    span: { start: 0, end: 0 },
    children: [child]
  }
  const view = renderer(new PresetBuilder().add(plugin).build())
  expect(
    view.render({ source: '', children: [parent] }, { roots: [child] })
  ).toBe('0')
  expect(seen).toEqual([['container']])
  expect(
    view.render(
      { source: '', children: [parent] },
      { childText: new Map([[parent, '<new>']]) }
    )
  ).toBe('[&lt;new&gt;]')
})

test('registration handles survive revisions and reject changes through other builders', () => {
  const plugin = new RenderPlugin(new PluginDeclaration('replace')).on(
    'text',
    () => 'before'
  )
  const builder = new PresetBuilder()
  const registration = builder.register(plugin)
  const before = renderer(builder.build())
  const document = {
    source: '',
    children: [{ kind: 'text', data: {}, span: { start: 0, end: 0 } }]
  }
  builder.replace(
    registration,
    plugin.replace('text', () => 'after')
  )
  expect(renderer(builder.build()).render(document)).toBe('after')
  expect(before.render(document)).toBe('before')
  expect(() => new PresetBuilder().remove(registration)).toThrow(
    /Missing registration/
  )
  builder.remove(registration)
  expect(renderer(builder.build()).render(document)).toBe('')
})

test('fallback preserves leading BOM and cyclic documents fail before rendering', () => {
  const view = renderer(new PresetBuilder().build())
  expect(
    view.render({
      source: '\uFEFFx',
      children: [{ kind: 'unknown', data: {}, span: { start: 0, end: 4 } }]
    })
  ).toBe('\uFEFFx')
  const node: MutableNode = {
    kind: 'cycle',
    data: {},
    span: { start: 0, end: 0 },
    children: []
  }
  node.children!.push(node)
  expect(() => view.render({ source: '', children: [node] })).toThrow(/tree/)
})

test('invalid Unicode is rejected in source, node kinds, payload keys and payload values', () => {
  const node = { kind: 'text', data: {}, span: { start: 0, end: 0 } }
  const documents = [
    { source: '\uD800', children: [] },
    { source: '', children: [{ ...node, kind: '\uDC00' }] },
    { source: '', children: [{ ...node, data: { value: '\uD800' } }] },
    { source: '', children: [{ ...node, data: { '\uDC00': 'value' } }] }
  ]
  for (const document of documents)
    expect(() => new DocumentContext(document)).toThrow(/surrogate/)
  expect(
    new DocumentContext({
      source: '',
      children: [{ ...node, data: { value: 'é😀\uFEFF' } }]
    }).document.children[0].data
  ).toEqual({ value: 'é😀\uFEFF' })
})

test('limits are finite integers and payload allocations are bounded before validation callbacks', () => {
  for (const value of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['sourceBytes', 'payloadBytes', 'nodes', 'depth'])
      expect(
        () =>
          new DocumentContext(
            { source: '', children: [] },
            {
              limits: {
                ...documentLimits,
                [key]: value
              }
            }
          )
      ).toThrow(/finite nonnegative integers/)
  }
  let validations = 0
  const definitions = [
    defineNode('text', () => {
      validations++
      return true
    })
  ]
  const node = {
    kind: 'text',
    data: { value: 'é'.repeat(20) },
    span: { start: 0, end: 0 }
  }
  expect(
    () =>
      new DocumentContext(
        { source: '', children: [node] },
        {
          definitions,
          limits: {
            ...documentLimits,
            payloadBytes: 32
          }
        }
      )
  ).toThrow(/payload byte limit/)
  expect(
    () =>
      new DocumentContext(
        { source: '', children: [{ ...node, data: new Array(1000) }] },
        { definitions, limits: { ...documentLimits, payloadBytes: 32 } }
      )
  ).toThrow(/payload byte limit/)
  expect(validations).toBe(0)
  const small = { ...node, data: { value: 'abcdefgh' } }
  expect(
    () =>
      new DocumentContext(
        { source: '', children: [small, { ...small }] },
        { limits: { ...documentLimits, payloadBytes: 30 } }
      )
  ).toThrow(/payload byte limit/)
  expect(
    new DocumentContext(
      { source: '', children: [] },
      {
        limits: {
          sourceBytes: 0,
          payloadBytes: 0,
          nodes: 0,
          depth: 0
        }
      }
    ).document.children
  ).toEqual([])
})

test('external AST and payload accessors are rejected without invoking them', () => {
  let getters = 0
  const getter = () => {
    getters++
    return 'value'
  }
  const node = { kind: 'text', data: {}, span: { start: 0, end: 0 } }
  const documents = [
    Object.defineProperty({ children: [] }, 'source', {
      get: getter,
      enumerable: true
    }),
    {
      source: '',
      children: [
        Object.defineProperty({ ...node }, 'span', {
          get: getter,
          enumerable: true
        })
      ]
    },
    {
      source: '',
      children: [
        {
          ...node,
          span: Object.defineProperty({ end: 0 }, 'start', {
            get: getter,
            enumerable: true
          })
        }
      ]
    },
    {
      source: '',
      children: [
        {
          ...node,
          data: Object.defineProperty({}, 'value', {
            get: getter,
            enumerable: true
          })
        }
      ]
    },
    {
      source: '',
      children: Object.defineProperty([node], '0', { get: getter })
    }
  ]
  for (const document of documents)
    expect(() => new DocumentContext(document as never)).toThrow(/accessors/)
  expect(getters).toBe(0)
  const coercible = { valueOf: getter }
  expect(
    () =>
      new DocumentContext({
        source: '',
        children: [{ ...node, span: { start: coercible, end: 0 } }]
      } as never)
  ).toThrow(/span/)
  expect(getters).toBe(0)
})

test('validation callbacks cannot change captured kinds, spans or expand scheduled siblings', () => {
  const node = { kind: 'text', data: {}, span: { start: 0, end: 1 } }
  const children = [node]
  const context = new DocumentContext(
    { source: 'x', children },
    {
      definitions: [
        defineNode('text', () => {
          node.kind = 'changed'
          node.span.end = 1000
          children.push({
            kind: 'foreign',
            data: {},
            span: { start: 0, end: 1 }
          })
          return true
        })
      ]
    }
  )
  expect(context.document.children).toHaveLength(1)
  expect(context.document.children[0].kind).toBe('text')
  expect(context.document.children[0].span).toEqual({ start: 0, end: 1 })
})

test('a changing external declaration cannot register its validator under another kind', () => {
  let reads = 0
  let handlers = 0
  const declaration = {
    ...defineNode('text', () => false),
    get kind() {
      return ++reads === 1 ? 'text' : 'different'
    }
  }
  const plugin = new RenderPlugin(new PluginDeclaration('changing-kind')).on(
    declaration,
    () => {
      handlers++
      return 'invalid handler ran'
    }
  )
  const view = renderer(new PresetBuilder().add(plugin).build())
  expect(() =>
    view.render({
      source: '',
      children: [{ kind: 'text', data: {}, span: { start: 0, end: 0 } }]
    })
  ).toThrow(/Invalid render payload/)
  expect(reads).toBe(1)
  expect(handlers).toBe(0)
})
