import type { Node } from './ast.js'

export type NodeKind = { kind: string; data: unknown }

export type NodeRole = 'block' | 'inline' | 'structural' | 'opaque'
export interface NodeStructure {
  readonly role: NodeRole
  readonly children:
    | { readonly kind: 'leaf' | 'any' }
    | {
        readonly kind: 'roles'
        readonly roles: readonly NodeRole[]
        readonly nonempty: boolean
      }
    | {
        readonly kind: 'types'
        readonly types: readonly string[]
        readonly nonempty: boolean
      }
    | {
        readonly kind: 'table'
        readonly header: string
        readonly row: string
        readonly columnsField: string
      }
}

const roles = new Set<NodeRole>(['block', 'inline', 'structural', 'opaque'])
const ownedDefinitions = new WeakSet<NodeDefinition>()

/** Internal cache identity: only defineNode creates immutable declarations. */
export function isOwnedDefinition(value: NodeDefinition): boolean {
  return ownedDefinitions.has(value)
}

/** Copy declaration metadata so later mutations cannot change a validation contract. */
function snapshotStructure(value: NodeStructure): NodeStructure {
  if (!value) throw new TypeError('Invalid node structure')
  const { role, children } = value
  if (!roles.has(role) || !children)
    throw new TypeError('Invalid node structure')
  const kind = children.kind
  let copy: NodeStructure['children']
  switch (kind) {
    case 'leaf':
    case 'any':
      copy = { kind }
      break
    case 'roles': {
      const { roles: input, nonempty } = children
      const values = Array.isArray(input) ? [...input] : undefined
      if (
        !values ||
        values.some(role => !roles.has(role)) ||
        typeof nonempty !== 'boolean'
      )
        throw new TypeError('Invalid node role constraint')
      copy = {
        kind: 'roles',
        roles: Object.freeze([...new Set(values)].sort()),
        nonempty
      }
      break
    }
    case 'types': {
      const { types: input, nonempty } = children
      const values = Array.isArray(input) ? [...input] : undefined
      if (
        !values ||
        values.some(type => typeof type !== 'string') ||
        typeof nonempty !== 'boolean'
      )
        throw new TypeError('Invalid node type constraint')
      copy = {
        kind: 'types',
        types: Object.freeze([...new Set(values)].sort()),
        nonempty
      }
      break
    }
    case 'table': {
      const { header, row, columnsField } = children
      if ([header, row, columnsField].some(type => typeof type !== 'string'))
        throw new TypeError('Invalid table constraint')
      copy = {
        kind: 'table',
        header,
        row,
        columnsField
      }
      break
    }
    default:
      throw new TypeError('Invalid node child constraint')
  }
  return Object.freeze({ role, children: Object.freeze(copy) })
}

/** The shared identity and payload validator for a node kind. */
export interface NodeDefinition<K extends NodeKind = NodeKind> {
  readonly kind: K['kind']
  readonly validateData: (data: unknown) => boolean
  readonly structure: NodeStructure
  is<T extends NodeKind>(node: T): node is T & K
}

export function defineNode<K extends NodeKind>(
  kind: K['kind'],
  validateData: (data: unknown) => boolean,
  structure: NodeStructure = { role: 'opaque', children: { kind: 'any' } }
): NodeDefinition<K> {
  if (typeof kind !== 'string' || typeof validateData !== 'function')
    throw new TypeError('Expected node kind and payload validator')
  const definition = Object.freeze({
    kind,
    validateData,
    structure: snapshotStructure(structure),
    is<T extends NodeKind>(node: T): node is T & K {
      return node.kind === kind && validateData(node.data)
    }
  })
  ownedDefinitions.add(definition)
  return definition
}

export type DefinedNode<D extends NodeDefinition> =
  D extends NodeDefinition<infer K> ? Node & K : never

/** Evaluate the same child constraints used by native and generated consumers. */
export function validateStructure(
  node: Node,
  structures: ReadonlyMap<string, NodeStructure>
): void {
  const rule = structures.get(node.kind)?.children
  if (!rule || rule.kind === 'any') return
  const children = node.children ?? []
  let valid: boolean
  switch (rule.kind) {
    case 'leaf':
      valid = children.length === 0
      break
    case 'roles':
      valid =
        (!rule.nonempty || children.length > 0) &&
        children.every(child =>
          rule.roles.includes(structures.get(child.kind)?.role ?? 'opaque')
        )
      break
    case 'types':
      valid =
        (!rule.nonempty || children.length > 0) &&
        children.every(child => rule.types.includes(child.kind))
      break
    case 'table': {
      const data = node.data
      const columns =
        typeof data === 'object' && data !== null && !Array.isArray(data)
          ? (data as Record<string, unknown>)[rule.columnsField]
          : undefined
      valid =
        Array.isArray(columns) &&
        columns.length > 0 &&
        children.length > 0 &&
        children.every(
          (child, index) =>
            child.kind === (index === 0 ? rule.header : rule.row) &&
            child.children?.length === columns.length
        )
      break
    }
  }
  if (!valid) throw new TypeError('Invalid node children: ' + node.kind)
}
