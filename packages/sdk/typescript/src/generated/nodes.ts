// Generated from Rust contracts. Do not edit.
import * as commonmark from '@traq-flavored-markdown/commonmark-plugin/nodes'
import * as extensions from '@traq-flavored-markdown/extensions-plugin/nodes'
import * as traq from '@traq-flavored-markdown/traq-plugin/nodes'
import {
  type MutableDocument as AstMutableDocument,
  type MutableNode as AstMutableNode,
  type ReadonlyDocument as AstReadonlyDocument,
  type ReadonlyNode as AstReadonlyNode,
  type DeepReadonly,
  DocumentSchema
} from '@traq-flavored-markdown/core'

export type NodeVariant =
  commonmark.NodeVariant | extensions.NodeVariant | traq.NodeVariant
export type MutableNode = AstMutableNode<NodeVariant>
export type MutableDocument = AstMutableDocument<NodeVariant>
export type ReadonlyNode = AstReadonlyNode<NodeVariant>
export type ReadonlyDocument = AstReadonlyDocument<NodeVariant>
export const names = Object.freeze({
  ...commonmark.names,
  ...extensions.names,
  ...traq.names
})
export const definitions = Object.freeze({
  ...commonmark.definitions,
  ...extensions.definitions,
  ...traq.definitions
})
export const schema = new DocumentSchema<NodeVariant>(
  Object.values(definitions)
)
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & DeepReadonly<NodeVariant> {
  return schema.isKnownNode(node)
}
