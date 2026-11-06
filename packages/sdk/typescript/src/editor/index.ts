import { names as common } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { DeepReadonly, ReadonlyNode } from '@traq-flavored-markdown/core'
import { names as extensions } from '@traq-flavored-markdown/extensions-plugin/nodes'

import type { NodeVariant } from '../generated/nodes.js'
import type { SyntaxMarker } from '../generated/processing.js'
import type { ParsedSyntax } from '../runtime/syntax.js'
import type { ParsedDocument } from '../runtime/types.js'

/** Half-open offsets in the original JavaScript string, measured in UTF-16. */
export interface EditorRange {
  readonly from: number
  readonly to: number
}
export interface EditorMarker {
  readonly kind: SyntaxMarker['kind']
  readonly ranges: readonly EditorRange[]
  readonly columns?: number
  readonly text?: string
}
export interface EditorNode {
  readonly node: ReadonlyNode<NodeVariant>
  readonly range: EditorRange
  readonly content: readonly EditorRange[]
  readonly markers: readonly EditorMarker[]
}
export interface EditorContainer {
  readonly node: ReadonlyNode<NodeVariant>
  readonly kind: 'quote' | 'list'
  readonly prefix?: EditorMarker
  readonly continuation: string
  readonly list?: Readonly<{ marker: string; leading: string; spacing: string }>
}
export interface EditorLine extends EditorRange {
  readonly contentFrom: number
  readonly containers: readonly EditorContainer[]
  readonly quoteDepth: number
  readonly indent: number
  readonly literal: boolean
}
export interface EditorAnalysis {
  readonly document: ParsedDocument
  readonly nodes: readonly EditorNode[]
  readonly lines: readonly EditorLine[]
  readonly detached: readonly EditorMarker[]
}

const analyses = new WeakMap<ParsedSyntax, EditorAnalysis>()

/** Reuse parser decisions for editing; no Markdown is parsed in this adapter. */
export function analyzeForEditing(parsed: ParsedSyntax): EditorAnalysis {
  const cached = analyses.get(parsed)
  if (cached) return cached
  const { document } = parsed
  const source = document.source
  const range = (span: Readonly<{ start: number; end: number }>): EditorRange =>
    Object.freeze({
      from: source.utf16Offset(span.start),
      to: source.utf16Offset(span.end)
    })
  const marker = (value: DeepReadonly<SyntaxMarker>): EditorMarker =>
    Object.freeze({
      kind: value.kind,
      ranges: Object.freeze(value.spans.map(range)),
      ...(value.columns === undefined || value.columns === null
        ? {}
        : { columns: value.columns }),
      ...(value.text === undefined || value.text === null
        ? {}
        : { text: value.text })
    })
  const nodes: EditorNode[] = []
  for (const node of document.walk()) {
    const facts = parsed.syntaxFor(node).source
    if (!facts) continue
    nodes.push(
      Object.freeze({
        node,
        range: range(node.span),
        content: Object.freeze(facts.content.map(range)),
        markers: Object.freeze(facts.markers.map(marker))
      })
    )
  }

  type Line = {
    from: number
    to: number
    contentFrom: number
    containers: EditorContainer[]
    quoteDepth: number
    indent: number
    literal: boolean
  }
  const lines: Line[] = []
  let from = 0
  for (const match of source.text.matchAll(/\r\n|\r|\n/g)) {
    lines.push({
      from,
      to: match.index,
      contentFrom: from,
      containers: [],
      quoteDepth: 0,
      indent: 0,
      literal: false
    })
    from = match.index + match[0].length
  }
  lines.push({
    from,
    to: source.text.length,
    contentFrom: from,
    containers: [],
    quoteDepth: 0,
    indent: 0,
    literal: false
  })
  const lineAt = (position: number) => {
    let lo = 0
    let hi = lines.length
    while (lo + 1 < hi) {
      const middle = (lo + hi) >>> 1
      if (lines[middle].from <= position) lo = middle
      else hi = middle
    }
    return lo
  }
  const endOf = (entry: EditorNode) => {
    const end = entry.range.to
    const last = lines[lineAt(end)]
    // Legacy AST envelopes may end after the next outer-container prefix.
    let useful = entry.range.from
    for (const part of entry.content) useful = Math.max(useful, part.to)
    for (const marker of entry.markers)
      for (const part of marker.ranges) useful = Math.max(useful, part.to)
    return useful <= last.from && last.from < end && end <= last.to
      ? last.from
      : end
  }
  for (const entry of nodes) {
    const kind = entry.node.kind
    const isQuote = kind === common.Blockquote
    const isList = kind === common.ListItem
    const literal = kind === common.CodeBlock || kind === extensions.BlockMath
    if (!isQuote && !isList && !literal) continue
    const prefixes = entry.markers.filter(
      m => m.kind === 'prefix' && m.ranges.length > 0
    )
    const byLine = new Map(
      prefixes.map(prefix => [lineAt(prefix.ranges[0].from), prefix])
    )
    const first = prefixes[0]
    const text = first?.text ?? ''
    const opening = entry.markers.find(m => m.kind === 'open')
    const symbol =
      isList && opening
        ? opening.ranges.map(r => source.text.slice(r.from, r.to)).join('')
        : ''
    const leadingLength = symbol ? text.indexOf(symbol) : -1
    const list =
      leadingLength < 0
        ? undefined
        : Object.freeze({
            marker: symbol,
            leading: text.slice(0, leadingLength),
            spacing: text.slice(leadingLength + symbol.length) || ' '
          })
    const width =
      (first?.columns ?? 0) + (list && text.endsWith(symbol) ? 1 : 0)
    const continuation = isQuote ? text || '> ' : ' '.repeat(width)
    const end = endOf(entry)
    for (
      let index = lineAt(entry.range.from);
      index < lines.length && lines[index].from < end;
      index++
    ) {
      const line = lines[index]
      if (literal) {
        line.literal = true
        continue
      }
      const prefix = byLine.get(index)
      line.containers.push(
        Object.freeze({
          node: entry.node,
          kind: isQuote ? 'quote' : 'list',
          prefix,
          continuation,
          ...(list ? { list } : {})
        })
      )
      if (prefix)
        for (const part of prefix.ranges)
          line.contentFrom = Math.max(line.contentFrom, part.to)
      if (isQuote) line.quoteDepth++
      line.indent += Math.max(0, width - (prefix?.columns ?? 0))
    }
  }
  const result = Object.freeze({
    document,
    nodes: Object.freeze(nodes),
    lines: Object.freeze(
      lines.map(line =>
        Object.freeze({ ...line, containers: Object.freeze(line.containers) })
      )
    ),
    detached: Object.freeze(parsed.syntax.detached.map(marker))
  })
  analyses.set(parsed, result)
  return result
}

export type { NodeSyntax, ParsedSyntax, SyntaxTree } from '../runtime/syntax.js'
export type {
  SourceSyntax,
  SyntaxMarker,
  SyntaxMarkerKind
} from '../generated/processing.js'
