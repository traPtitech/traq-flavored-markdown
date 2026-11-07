import type { ParsedDocument, ReadonlyNode } from '@traq-flavored-markdown/sdk'
import type {
  SourceAnalysis as MarkdownSourceAnalysis,
  SourceNode as MarkdownSourceNode
} from '@traq-flavored-markdown/sdk/editor'
import { names } from '@traq-flavored-markdown/sdk/nodes'

import type { SourceRange } from '../types.js'

type FormatBase = SourceRange & {
  readonly classSuffix: string
  readonly style?: 'strong' | 'emphasis' | 'strike' | 'highlight' | 'spoiler'
  readonly syntax: readonly SourceRange[]
  readonly content: SourceRange
  readonly contentRanges?: readonly SourceRange[]
}

export type MarkdownFormat = FormatBase &
  (
    | {
        readonly kind: 'text-style' | 'literal' | 'source-only'
        readonly replacement?: never
        readonly container?: never
      }
    | {
        readonly kind: 'rendered-inline'
        readonly replacement: Readonly<{
          type: 'markdown' | 'stamp'
          text: string
          document: ParsedDocument
          node: ReadonlyNode
          renderKey: string
        }>
        readonly container?: never
      }
    | {
        readonly kind: 'container'
        readonly container: Readonly<{ quoteDepth: number; indent: number }>
        readonly replacement?: never
      }
    | {
        readonly kind: 'list-marker' | 'rule'
        readonly replacement?: never
        readonly container?: never
      }
  )

export const isMarkdownSourceOnly = (format: MarkdownFormat) =>
  format.kind === 'source-only'

const toFormat = (
  node: MarkdownSourceNode,
  analysis: MarkdownSourceAnalysis
): MarkdownFormat => {
  const { source, document } = analysis
  const { from, to, syntax } = node
  const first = node.content[0]
  const last = node.content.at(-1)
  const content = { from: first?.from ?? from, to: last?.to ?? from }
  const base = {
    from,
    to,
    content,
    syntax,
    ...(node.content.length > 1 ? { contentRanges: node.content } : {})
  }

  switch (node.kind) {
    case 'style':
      return {
        ...base,
        kind: 'text-style',
        style: node.style,
        classSuffix: node.style
      }

    case 'heading':
      return {
        ...base,
        kind: 'text-style',
        classSuffix:
          node.native.kind === names.Heading
            ? `h${node.native.data.level}`
            : 'heading'
      }

    case 'link':
      return { ...base, kind: 'text-style', classSuffix: 'link' }

    case 'code':
    case 'code-block':
      return { ...base, kind: 'literal', classSuffix: node.kind }

    case 'math':
    case 'math-block':
    case 'table':
      return {
        ...base,
        content: { from, to },
        syntax: node.kind === 'table' ? [] : [{ from, to }],
        kind: 'source-only',
        classSuffix: node.kind
      }

    case 'image':
    case 'stamp':
      return {
        ...base,
        content: { from, to },
        syntax: [{ from, to }],
        kind: 'rendered-inline',
        classSuffix: 'rendered',
        replacement: {
          type: node.kind === 'image' ? 'markdown' : 'stamp',
          text: source.slice(from, to),
          document,
          node: node.native,
          renderKey: JSON.stringify(node.native)
        }
      }

    case 'container':
      return {
        ...base,
        kind: 'container',
        classSuffix: node.container.quoteDepth ? 'quote' : 'list-item',
        container: node.container
      }

    case 'list-marker':
      return {
        ...base,
        kind: 'list-marker',
        classSuffix: 'bullet'
      }

    case 'rule':
      return {
        ...base,
        content: { from, to },
        syntax: [{ from, to }],
        kind: 'rule',
        classSuffix: 'rule'
      }
  }
}

const formatsByAnalysis = new WeakMap<
  MarkdownSourceAnalysis,
  readonly MarkdownFormat[]
>()

export const markdownFormats = (
  analysis: MarkdownSourceAnalysis
): readonly MarkdownFormat[] => {
  let formats = formatsByAnalysis.get(analysis)

  if (!formats) {
    formats = analysis.nodes.map(node => toFormat(node, analysis))
    formatsByAnalysis.set(analysis, formats)
  }

  return formats
}
