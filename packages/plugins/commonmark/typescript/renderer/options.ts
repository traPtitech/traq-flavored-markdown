/** HTML returned by a highlighter is trusted. `block` includes its own `<pre>`. */
export type HighlightResult =
  { kind: 'content'; html: string } | { kind: 'block'; html: string }

export interface Options {
  validateLink?(destination: string): boolean
  validateImage?(destination: string): boolean
  breaks?: boolean
  rawHtml?: 'passthrough' | 'escape'
  xhtmlOut?: boolean

  /** Return highlighted HTML, or nothing to use escaped code. */
  highlight?(code: string, language: string): HighlightResult | undefined

  linkAttributes?: Readonly<Record<string, string>>
}
