import type { ReadonlyNode } from '../generated/nodes.js'
import { names } from '../generated/nodes.js'
import type { ParsedDocument } from '../runtime/types.js'
import type { EditorAnalysis, EditorLine, EditorRange } from './index.js'

type SourceNodeBase = EditorRange & {
  readonly content: readonly EditorRange[]
  readonly syntax: readonly EditorRange[]
  readonly native: ReadonlyNode
}
export type SourceNode = SourceNodeBase &
  (
    | {
        readonly kind:
          | 'heading'
          | 'code'
          | 'code-block'
          | 'math'
          | 'math-block'
          | 'table'
          | 'image'
          | 'stamp'
          | 'rule'
          | 'list-marker'
      }
    | {
        readonly kind: 'style'
        readonly style:
          'strong' | 'emphasis' | 'strike' | 'highlight' | 'spoiler'
      }
    | { readonly kind: 'link'; readonly href: string }
    | {
        readonly kind: 'container'
        readonly container: Readonly<{ quoteDepth: number; indent: number }>
      }
  )
export type SourceAnalysis = Readonly<{
  source: string
  document: ParsedDocument
  lines: readonly EditorLine[]
  nodes: readonly SourceNode[]
}>
export const isLiteralSource = (node: SourceNode) =>
  node.kind === 'code' ||
  node.kind === 'code-block' ||
  node.kind === 'math' ||
  node.kind === 'math-block'

const styles = new Map<
  string,
  'strong' | 'emphasis' | 'strike' | 'highlight' | 'spoiler'
>([
  [names.Strong, 'strong'],
  [names.Emphasis, 'emphasis'],
  [names.Strikethrough, 'strike'],
  [names.Mark, 'highlight'],
  [names.Spoiler, 'spoiler']
])
const descriptions = new WeakMap<EditorAnalysis, SourceAnalysis>()
/** Describe source geometry without selecting DOM classes or an editor framework. */
export const describeSource = (editing: EditorAnalysis): SourceAnalysis => {
  const cached = descriptions.get(editing)
  if (cached) return cached
  const source = editing.document.source.text
  const nodes: SourceNode[] = []
  for (const entry of editing.nodes) {
    const native = entry.node
    const block = [
      names.Heading,
      names.CodeBlock,
      names.BlockMath,
      names.Table,
      names.ThematicBreak
    ].some(kind => kind === native.kind)
    const range = { ...entry.range }
    if (block)
      range.to -=
        /(?:\r\n|\r|\n)$/.exec(source.slice(range.from, range.to))?.[0]
          .length ?? 0
    const syntax = entry.markers
      .filter(marker => marker.kind !== 'info')
      .flatMap(marker => marker.ranges)
      .map(part => ({ from: part.from, to: Math.min(part.to, range.to) }))
    const empty = Math.min(
      range.to,
      entry.markers.find(marker => marker.kind === 'open')?.ranges.at(-1)?.to ??
        range.from
    )
    const content = entry.content.length
      ? entry.content.map(part => ({
          from: part.from,
          to: Math.min(part.to, range.to)
        }))
      : [{ from: empty, to: empty }]
    const base = { ...range, content, syntax, native }
    const style = styles.get(native.kind)
    if (style) nodes.push({ ...base, kind: 'style', style })
    else
      switch (native.kind) {
        case names.Heading:
          nodes.push({ ...base, kind: 'heading' })
          break
        case names.Link:
          nodes.push({ ...base, kind: 'link', href: native.data.destination })
          break
        case names.InlineCode:
          nodes.push({ ...base, kind: 'code' })
          break
        case names.CodeBlock:
          nodes.push({ ...base, kind: 'code-block' })
          break
        case names.InlineMath:
          nodes.push({ ...base, kind: 'math' })
          break
        case names.BlockMath:
          nodes.push({
            ...base,
            kind: 'math-block'
          })
          break
        case names.Table:
          nodes.push({ ...base, kind: 'table' })
          break
        case names.ThematicBreak:
          nodes.push({ ...base, kind: 'rule' })
          break
        case names.Image:
          nodes.push({
            ...base,
            kind: 'image'
          })
          break
        case names.Stamp:
          nodes.push({
            ...base,
            kind: 'stamp'
          })
          break
      }
  }
  // Inner styles precede their enclosing styles, in source order.
  nodes.sort((a, b) => a.to - b.to || b.from - a.from)
  const lines = editing.lines
  for (const line of lines) {
    const first = line.containers[0]
    if (!first) continue
    nodes.push({
      kind: 'container',
      from: line.from,
      to: line.to,
      native: first.node,
      content: [{ from: line.contentFrom, to: line.to }],
      syntax: line.containers
        .filter(part => part.kind === 'quote')
        .flatMap(part => part.prefix?.ranges ?? []),
      container: { quoteDepth: line.quoteDepth, indent: line.indent }
    })
    for (const part of line.containers) {
      const markers =
        part.marker?.ranges.filter(
          range => line.from <= range.from && range.to <= line.to
        ) ?? []
      if (part.kind === 'list' && markers.length)
        nodes.push({
          kind: 'list-marker',
          from: line.from,
          to: line.to,
          content: markers,
          syntax: markers,
          native: part.node
        })
    }
  }
  const result = Object.freeze({
    source,
    document: editing.document,
    lines,
    nodes: Object.freeze(
      nodes.map(node =>
        Object.freeze({
          ...node,
          content: Object.freeze(
            node.content.map(range => Object.freeze(range))
          ),
          syntax: Object.freeze(node.syntax.map(range => Object.freeze(range))),
          ...(node.kind === 'container'
            ? { container: Object.freeze(node.container) }
            : {})
        })
      )
    )
  })
  descriptions.set(editing, result)
  return result
}
