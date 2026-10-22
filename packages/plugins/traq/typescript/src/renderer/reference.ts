import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { Node } from '@traq-flavored-markdown/core/renderer'
import type { Reference } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { Options } from './types.js'

export function renderReference(
  node: Node & { data: Reference },
  resolve: Options['resolveReference'],
  validateLink: (destination: string) => boolean
) {
  const { type } = node.data
  const resolved = resolve?.(node.data)
  const label = resolved?.label ?? node.data.label
  const href = resolved?.href

  if (!href || !validateLink(href)) return escapeHtml(label)

  const cls = `message-${type}-link`

  return (
    '<a' +
    attributes([
      ['href', href],
      ['class', resolved?.highlight ? `${cls}-highlight ${cls}` : cls]
    ]) +
    '>' +
    escapeHtml(label) +
    '</a>'
  )
}
