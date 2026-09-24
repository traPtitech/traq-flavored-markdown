import type { Document, Node } from '../ast.js'

export type { Node, Document } from '../ast.js'

export interface RenderContext {
  /** Ancestors in outermost-to-innermost order, excluding the current node. */
  ancestors: readonly Node[]
  source: string
  /** Escape text before including it in a custom HTML handler. */
  escape(text: string): string
  render(nodes?: Node[]): string
  fallback(node: Node): string
}

/** Handlers return trusted HTML. Escape values obtained from the document. */
export type Handler = (node: Node, context: RenderContext) => string

/** Receives HTML-escaped source for a node without a render handler. */
export type Fallback = (escapedSource: string) => string

declare const identity: unique symbol

export interface Preset {
  readonly [identity]: 'renderer-preset'
}

/** Presentation changes keyed by nodes in the original document. */
export interface RenderOverlay {
  roots?: readonly Node[]
  omittedNodes?: ReadonlySet<Node>
  /** Plain text to show in place of a node's rendered children. */
  childText?: ReadonlyMap<Node, string>
}

export interface Renderer {
  render(document: Document, overlay?: RenderOverlay): string
}
