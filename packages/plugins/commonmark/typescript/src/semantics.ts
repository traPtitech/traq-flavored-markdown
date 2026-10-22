import type { ReadonlyNode as Node, Span } from '@traq-flavored-markdown/core'

import { isKnownNode, names } from './generated/commonmark.js'

/** Plain label projection defined by CommonMark, independent of HTML serialization. */
export function imageLabelText(
  nodes: readonly Node[] = [],
  sourceSlice: (span: Span) => string
): string {
  const collect = (children: readonly Node[] = []): string =>
    children
      .map(node => {
        if (!isKnownNode(node)) return sourceSlice(node.span)

        switch (node.kind) {
          case names.Text:
            return node.data.value
          case names.HtmlInline:
            return node.data.literal
          case names.Softbreak:
          case names.Hardbreak:
            return '\n'
          case names.InlineCode:
            return node.data.literal
          default:
            return collect(node.children)
        }
      })
      .join('')

  return collect(nodes)
}

/** The parser already decoded Markdown escapes and entities in semantic info. */
export function codeLanguage(info: string): string {
  return info.trim().split(/\s+/)[0]
}
