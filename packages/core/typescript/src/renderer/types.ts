import type {
  DeepReadonly,
  ReadonlyDocument,
  ReadonlyNode,
  Span
} from '../ast.js'
import type { DocumentContext } from '../document.js'
import type { NodeVariant } from '../nodes.js'
import type { NodeDefinition } from '../nodes.js'

export type { ReadonlyNode, ReadonlyDocument } from '../ast.js'

export interface RenderedChild {
  readonly node: ReadonlyNode
  readonly html: string
}

export interface RenderContext {
  /** Ancestors in outermost-to-innermost order, excluding the current node. */
  ancestors: readonly ReadonlyNode[]
  /** Position among the node's original siblings. */
  index: number
  /** Narrow an owned node using a contract already validated by its schema. */
  matches<Variant extends NodeVariant>(
    node: ReadonlyNode,
    definition: NodeDefinition<Variant>
  ): node is ReadonlyNode & ReadonlyNode<Variant>
  /** Get a typed ancestor whose contract was validated by the document schema. */
  parent<Variant extends NodeVariant>(
    definition: NodeDefinition<Variant>,
    distance?: number
  ): ReadonlyNode<Variant> | undefined
  source: string
  /** Escape text before including it in a custom HTML handler. */
  escape(text: string): string
  /** Dispatch visible children, then join them. childText bypasses the join callback. */
  renderChildren(
    join?: string | ((children: readonly RenderedChild[]) => string)
  ): string
  /** Dispatch an existing document node with its original ancestry and plan. */
  renderNode(node: ReadonlyNode): string
  sourceSlice(span: Span): string
  fallback(node: ReadonlyNode): string
}

/** Handlers return trusted HTML. Escape values obtained from the document. */
export type Handler<K extends NodeVariant = NodeVariant> = (
  node: ReadonlyNode & DeepReadonly<K>,
  context: RenderContext
) => string

/** Receives HTML-escaped source for a node without a render handler. */
export type Fallback = (escapedSource: string) => string

declare const identity: unique symbol

export interface HtmlPreset {
  readonly [identity]: 'html-preset'
}

/** Presentation changes keyed by original or snapshot nodes in this document. */
export interface RenderPlan {
  roots?: readonly ReadonlyNode[]
  omittedNodes?: ReadonlySet<ReadonlyNode>
  /** Plain text to show in place of a node's rendered children. */
  childText?: ReadonlyMap<ReadonlyNode, string>
  /** Separator between selected roots, for flattened document views. */
  rootSeparator?: string
}

export interface RenderSession {
  readonly context: DocumentContext
  render(plan?: RenderPlan): string
}

export interface Renderer {
  createSession(document: ReadonlyDocument | DocumentContext): RenderSession
  render(
    document: ReadonlyDocument | DocumentContext,
    plan?: RenderPlan
  ): string
}
