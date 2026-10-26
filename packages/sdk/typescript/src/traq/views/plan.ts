import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { ReadonlyNode } from '@traq-flavored-markdown/core'
import { names as traq } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { MessageAnalysis } from '../messages/analysis.js'
import { resourceLabels } from '../messages/labels.js'

/** Build view choices from a reusable semantic result. */
export function messageRenderPlan(
  analysis: MessageAnalysis,
  labels: Readonly<{ file: string; message: string }> = resourceLabels
) {
  const children = analysis.context.document.children
  const omittedNodes = new Set<ReadonlyNode>()
  const childText = new Map<ReadonlyNode, string>()
  for (const [node, { card, form }] of analysis.links) {
    if (card.type === 'file') childText.set(node, labels.file)
    else if (card.type === 'message' && form === 'linkify')
      childText.set(node, labels.message)
  }
  let last = children.length - 1
  while (children[last]?.kind === traq.BlankLine) last--
  const paragraph = children[last]
  if (paragraph?.kind === names.Paragraph && paragraph.children) {
    let end = paragraph.children.length - 1
    let removed = false
    while (end >= 0) {
      const node = paragraph.children[end]
      const previous = paragraph.children[end - 1]
      if (node.kind === names.Softbreak) {
        end--
        continue
      }
      const link = analysis.links.get(node)
      if (!link || link.card.type === 'url' || link.form !== 'linkify') break
      removed = true
      end -= previous?.kind === names.Softbreak ? 2 : 1
    }
    if (removed) {
      for (let i = end + 1; i < paragraph.children.length; i++)
        omittedNodes.add(paragraph.children[i])
      for (let i = last + 1; i < children.length; i++)
        omittedNodes.add(children[i])
    }
  }
  return {
    roots: children.filter(node => !omittedNodes.has(node)),
    omittedNodes,
    childText
  }
}
