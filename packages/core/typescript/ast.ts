/** A half-open UTF-8 byte range in the original source. */
export interface Span {
  start: number
  end: number
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

export { SourceText } from './source.js'
export type { SourceEdit } from './source.js'
export { DocumentContext, documentLimits } from './document.js'
export type { DocumentLimits, DocumentOptions } from './document.js'
export { defineNode } from './nodes.js'
export type {
  NodeDefinition,
  DefinedNode,
  NodeRole,
  NodeStructure
} from './nodes.js'
