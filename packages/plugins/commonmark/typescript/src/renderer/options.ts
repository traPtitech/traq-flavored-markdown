import type { ReadonlyNode } from '@traq-flavored-markdown/core/renderer'

/** HTML returned by a highlighter is trusted. `block` includes its own `<pre>`. */
export type HighlightResult =
  { kind: 'content'; html: string } | { kind: 'block'; html: string }

export interface HtmlRendererOptions {
  validateLink?(destination: string): boolean
  validateImage?(destination: string): boolean
  breaks?: boolean
  rawHtml?: 'passthrough' | 'escape'
  xhtmlOut?: boolean

  /** Return highlighted HTML, or nothing to use escaped code. */
  highlight?(code: string, language: string): HighlightResult | undefined

  linkAttributes?: Readonly<Record<string, string>>

  /** Identify extension nodes that supply their own spacing inside tight lists. */
  isBlockSpacing?(node: ReadonlyNode): boolean
}
