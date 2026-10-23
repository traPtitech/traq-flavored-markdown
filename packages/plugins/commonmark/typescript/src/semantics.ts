import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type {
  DocumentContext,
  ReadonlyNode,
  Span
} from '@traq-flavored-markdown/core'

/** Plain label projection defined by CommonMark, independent of HTML serialization. */
export function imageLabelText(
  nodes: readonly ReadonlyNode[] = [],
  sourceSlice: (span: Span) => string,
  matches: DocumentContext['matches']
): string {
  const collect = (children: readonly ReadonlyNode[] = []): string =>
    children
      .map(node => {
        if (matches(node, definitions.Text)) return node.data.value
        if (matches(node, definitions.HtmlInline)) return node.data.literal
        if (
          matches(node, definitions.Softbreak) ||
          matches(node, definitions.Hardbreak)
        )
          return '\n'
        if (matches(node, definitions.InlineCode)) return node.data.literal
        return node.children ? collect(node.children) : sourceSlice(node.span)
      })
      .join('')

  return collect(nodes)
}

/** The parser already decoded Markdown escapes and entities in semantic info. */
export function codeLanguage(info: string): string {
  return info.trim().split(/\s+/)[0]
}
