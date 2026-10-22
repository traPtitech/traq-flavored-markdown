import { DocumentContext, defineNode } from '@traq-flavored-markdown/core'
import type { Node } from '@traq-flavored-markdown/core'
import type { NodeStructure } from '@traq-flavored-markdown/core'
import { expect, test } from 'bun:test'

const valid = () => true
const definitions = [
  defineNode('text', valid, { role: 'inline', children: { kind: 'leaf' } }),
  defineNode('paragraph', valid, {
    role: 'block',
    children: { kind: 'roles', roles: ['inline'], nonempty: false }
  }),
  defineNode('list', valid, {
    role: 'block',
    children: { kind: 'types', types: ['item'], nonempty: true }
  }),
  defineNode('item', valid, {
    role: 'structural',
    children: { kind: 'roles', roles: ['block'], nonempty: false }
  }),
  defineNode('table', valid, {
    role: 'block',
    children: {
      kind: 'table',
      header: 'header',
      row: 'row',
      columnsField: 'alignments'
    }
  }),
  defineNode('header', valid, {
    role: 'structural',
    children: { kind: 'types', types: ['cell'], nonempty: true }
  }),
  defineNode('row', valid, {
    role: 'structural',
    children: { kind: 'types', types: ['cell'], nonempty: true }
  }),
  defineNode('cell', valid, {
    role: 'structural',
    children: { kind: 'roles', roles: ['inline'], nonempty: false }
  })
]
const node = (kind: string, children?: Node[], data: unknown = {}): Node => ({
  kind,
  span: { start: 0, end: 0 },
  data,
  ...(children ? { children } : {})
})
const context = (children: Node[]) =>
  new DocumentContext({ source: '', children }, { definitions })

test('node contracts reject malformed leaves, lists, roles and tables before dispatch', () => {
  const cell = () => node('cell', [node('text')])
  for (const malformed of [
    node('text', [node('text')]),
    node('paragraph', [node('list', [node('item')])]),
    node('paragraph', [node('unknown')]),
    node('list'),
    node('list', [node('paragraph')]),
    node('table', [], { alignments: ['left'] }),
    node('table', [node('row', [cell()])], { alignments: ['left'] }),
    node('table', [node('header', [cell(), cell()])], { alignments: ['left'] }),
    node('table', [node('header', [cell()]), node('header', [cell()])], {
      alignments: ['left']
    })
  ])
    expect(() => context([malformed])).toThrow(/Invalid node children/)
  expect(() =>
    context([
      node('list', [node('item', [node('paragraph', [node('text')])])]),
      node('table', [node('header', [cell()]), node('row', [cell()])], {
        alignments: [null]
      }),
      node('unknown', [node('text')])
    ])
  ).not.toThrow()
})

test('custom nodes declare roles and conflicting declarations do not poison a context', () => {
  const input = { source: '', children: [node('paragraph', [node('custom')])] }
  const custom = defineNode('custom', valid, {
    role: 'inline',
    children: { kind: 'leaf' }
  })
  const context = new DocumentContext(input, {
    definitions: [...definitions, custom]
  })
  const conflict = defineNode('custom', valid, {
    role: 'block',
    children: { kind: 'leaf' }
  })
  expect(() => context.validateDefinitions([conflict])).toThrow(/Conflicting/)
  expect(() => context.validateDefinitions([custom])).not.toThrow()
  expect(() =>
    context.validateDefinitions([
      defineNode('custom', () => false, custom.structure)
    ])
  ).toThrow(/payload/)
  expect(() => context.validateDefinitions([custom])).not.toThrow()
})

test('all source nodes are snapshotted before a user validator executes', () => {
  const child = node('text')
  const parent = node('paragraph', [child])
  const mutate = defineNode(
    'paragraph',
    () => {
      child.kind = 'list'
      parent.children!.push(node('unknown'))
      return true
    },
    definitions[1].structure
  )
  const context = new DocumentContext(
    { source: '', children: [parent] },
    { definitions: [mutate, definitions[0]] }
  )
  expect(context.document.children[0].children!.map(node => node.kind)).toEqual(
    ['text']
  )
})

test('definition metadata is copied and mutable structural definitions are revalidated', () => {
  const roles: ('inline' | 'block')[] = ['inline']
  const definition = defineNode('parent', valid, {
    role: 'block',
    children: { kind: 'roles', roles, nonempty: false }
  })
  roles.push('block')
  expect(definition.structure.children).toEqual({
    kind: 'roles',
    roles: ['inline'],
    nonempty: false
  })
  let calls = 0
  const external = {
    ...definitions[0],
    validateData: () => {
      calls++
      return true
    }
  }
  const context = new DocumentContext(
    { source: '', children: [node('text')] },
    { definitions: [external] }
  )
  context.validateDefinitions([external])
  expect(calls).toBe(2)
  external.validateData = () => false
  expect(() => context.validateDefinitions([external])).toThrow(/payload/)
})

test('reentrant validators cannot drop a structure while leaving its cached identity', () => {
  const context = new DocumentContext({
    source: '',
    children: [node('trigger'), node('parent', [node('custom')])]
  })
  const parent = defineNode('parent', valid, {
    role: 'block',
    children: { kind: 'roles', roles: ['opaque'], nonempty: false }
  })
  const trigger = defineNode('trigger', () => {
    context.validateDefinitions([parent])
    return true
  })
  expect(() => context.validateDefinitions([trigger])).toThrow(/not reentrant/)
  context.validateDefinitions([parent])
  const custom = defineNode('custom', valid, {
    role: 'inline',
    children: { kind: 'leaf' }
  })
  expect(() => context.validateDefinitions([custom])).toThrow(
    /Invalid node children/
  )
  expect(() => context.validateDefinitions([parent])).not.toThrow()
})

test('owned definitions retain the same metadata values that were checked', () => {
  let roles = 0
  let kinds = 0
  const structure = {
    get role() {
      return ++roles === 1 ? 'inline' : 'unchecked'
    },
    children: {
      get kind() {
        return ++kinds === 1 ? 'leaf' : 'unchecked'
      }
    }
  } as NodeStructure
  const definition = defineNode('custom', valid, structure)
  expect(definition.structure).toEqual({
    role: 'inline',
    children: { kind: 'leaf' }
  })
  expect([roles, kinds]).toEqual([1, 1])
})
