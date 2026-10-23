import type {
  DeepReadonly,
  ReadonlyDocument as Document,
  ReadonlyNode as Node,
  Span
} from '../ast.js'
import type { DocumentContext } from '../document.js'
import type { NodeVariant } from '../nodes.js'
import type { NodeDefinition } from '../nodes.js'

export type {
  ReadonlyNode as Node,
  ReadonlyDocument as Document
} from '../ast.js'

export interface RenderedChild {
  readonly node: Node
  readonly html: string
}

export interface RenderContext {
  /** Ancestors in outermost-to-innermost order, excluding the current node. */
  ancestors: readonly Node[]
  /** Position among the node's original siblings. */
  index: number
  /** Get a typed ancestor whose contract was validated by the document schema. */
  parent<Variant extends NodeVariant>(
    definition: NodeDefinition<Variant>,
    distance?: number
  ): Node<Variant> | undefined
  source: string
  /** Escape text before including it in a custom HTML handler. */
  escape(text: string): string
  /** Dispatch visible children, then join them. childText bypasses the join callback. */
  renderChildren(
    join?: string | ((children: readonly RenderedChild[]) => string)
  ): string
  /** Dispatch an existing document node with its original ancestry and plan. */
  renderNode(node: Node): string
  sourceSlice(span: Span): string
  fallback(node: Node): string
}

/** Handlers return trusted HTML. Escape values obtained from the document. */
export type Handler<K extends NodeVariant = NodeVariant> = (
  node: Node & DeepReadonly<K>,
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
  roots?: readonly Node[]
  omittedNodes?: ReadonlySet<Node>
  /** Plain text to show in place of a node's rendered children. */
  childText?: ReadonlyMap<Node, string>
  /** Separator between selected roots, for flattened document views. */
  rootSeparator?: string
}

export interface RenderSession {
  readonly context: DocumentContext
  render(plan?: RenderPlan): string
}

export interface Renderer {
  createSession(document: Document | DocumentContext): RenderSession
  render(document: Document | DocumentContext, plan?: RenderPlan): string
}
