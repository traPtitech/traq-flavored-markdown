import type { DeepReadonly, ReadonlyNode as Node, NodeVariant } from './ast.js'

export type { NodeVariant } from './ast.js'

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
        readonly kind: 'sequence'
        readonly prefix: readonly string[]
        readonly rest: string
        readonly arityField?: string
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
    case 'sequence': {
      const { prefix, rest, arityField } = children
      const values = Array.isArray(prefix) ? [...prefix] : undefined
      if (
        !values ||
        values.some(type => typeof type !== 'string') ||
        typeof rest !== 'string' ||
        (arityField !== undefined && typeof arityField !== 'string')
      )
        throw new TypeError('Invalid child sequence constraint')
      copy = {
        kind: 'sequence',
        prefix: Object.freeze(values),
        rest,
        ...(arityField === undefined ? {} : { arityField })
      }
      break
    }
    default:
      throw new TypeError('Invalid node child constraint')
  }
  return Object.freeze({ role, children: Object.freeze(copy) })
}

/** The shared identity and payload validator for a node kind. */
export interface NodeDefinition<K extends NodeVariant = NodeVariant> {
  readonly kind: K['kind']
  readonly validateData: (data: unknown) => boolean
  readonly structure: NodeStructure
  is<T extends NodeVariant>(node: T): node is T & DeepReadonly<K>
}

export function defineNode<K extends NodeVariant>(
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
    is<T extends NodeVariant>(node: T): node is T & DeepReadonly<K> {
      return node.kind === kind && validateData(node.data)
    }
  })
  ownedDefinitions.add(definition)
  return definition
}

export type DefinedNode<D extends NodeDefinition> =
  D extends NodeDefinition<infer K> ? Node & DeepReadonly<K> : never

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
    case 'sequence': {
      const data = node.data
      const arity =
        typeof data === 'object' && data !== null && !Array.isArray(data)
          ? (data as Record<string, unknown>)[rule.arityField ?? '']
          : undefined
      valid =
        (rule.arityField === undefined ||
          (Array.isArray(arity) && arity.length > 0)) &&
        children.length >= rule.prefix.length &&
        children.every(
          (child, index) =>
            child.kind === (rule.prefix[index] ?? rule.rest) &&
            (rule.arityField === undefined ||
              (child.children?.length ?? 0) === (arity as unknown[]).length)
        )
      break
    }
  }
  if (!valid) throw new TypeError('Invalid node children: ' + node.kind)
}
