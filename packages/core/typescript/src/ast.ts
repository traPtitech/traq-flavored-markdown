/** A half-open UTF-8 byte range in the original source. */
export interface Span {
  start: number
  end: number
}

export interface NodeVariant {
  kind: string
  data: unknown
}

export type Node<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> = Kind & { span: Span; children?: Node<Kind>[] }

export interface Document<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> {
  source: string
  children: Node<Kind>[]
}

/** A caller-owned tree that may be edited before creating a snapshot. */
export type MutableDocument<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> = Document<Kind>
export type MutableNode<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> = Node<Kind>

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

/** Nodes exposed by owned snapshots and consumers cannot be edited. */
export type ReadonlyNode<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> = DeepReadonly<Kind> & {
  readonly span: Readonly<Span>
  readonly children?: readonly ReadonlyNode<Kind>[]
}
export interface ReadonlyDocument<
  Kind extends { kind: string; data: unknown } = {
    kind: string
    data: unknown
  }
> {
  readonly source: string
  readonly children: readonly ReadonlyNode<Kind>[]
}

export { SourceText } from './source.js'
export type { SourceEdit } from './source.js'
export { DocumentContext, documentLimits } from './document.js'
export type { DocumentLimits, DocumentOptions } from './document.js'
export { DocumentSchema } from './schema.js'
export { DocumentValidationError } from './errors.js'
export { defineNode } from './nodes.js'
export type {
  NodeDefinition,
  DefinedNode,
  NodeRole,
  NodeStructure
} from './nodes.js'
