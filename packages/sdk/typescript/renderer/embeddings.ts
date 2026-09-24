import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { Document, Node } from '@traq-flavored-markdown/core/renderer'
import { names as trap } from '@traq-flavored-markdown/traq-plugin/nodes'

import { embeddingFromUrl } from './links.js'
import type { Embedding } from './links.js'

function trailingNodesToOmit(
  children: readonly Node[],
  links: ReadonlyMap<Node, Embedding>
) {
  const omitted = new Set<Node>()
  let last = children.length - 1

  while (children[last]?.kind === trap.BlankLine) last--

  const paragraph = children[last]
  if (paragraph?.kind !== names.Paragraph || !paragraph.children) return omitted

  let end = paragraph.children.length - 1
  let removed = false

  while (end >= 0) {
    const node = paragraph.children[end]
    const previous = paragraph.children[end - 1]
    const embedding = links.get(node)

    if (node.kind === names.Softbreak) {
      end--
      continue
    }

    if (
      embedding &&
      embedding.type !== 'url' &&
      isStandaloneLink(node, previous)
    ) {
      removed = true
      end -= previous?.kind === names.Softbreak ? 2 : 1
      continue
    }

    break
  }

  if (removed) {
    for (let index = end + 1; index < paragraph.children.length; index++)
      omitted.add(paragraph.children[index])
    for (let index = last + 1; index < children.length; index++)
      omitted.add(children[index])
  }

  return omitted
}

function isStandaloneLink(node: Node, previous?: Node): boolean {
  return (
    isKnownNode(node) &&
    node.kind === names.Link &&
    node.data.form === 'linkify' &&
    (!previous || previous.kind === names.Softbreak)
  )
}

/** Analyze a document once and keep presentation choices outside the AST. */
export function analyzeMessage(document: Document, origin: string) {
  const links = new Map<Node, Embedding>()
  const embeddings: Embedding[] = []
  const childText = new Map<Node, string>()
  const ids = new Set<string>()

  function visit(nodes: readonly Node[]) {
    for (const node of nodes) {
      if (node.kind === trap.Spoiler) continue

      if (isKnownNode(node) && node.kind === names.Link) {
        const embedding = embeddingFromUrl(node.data.destination, origin)
        if (embedding) {
          links.set(node, embedding)
          if (embedding.type === 'url' || !ids.has(embedding.id)) {
            embeddings.push(embedding)
            if (embedding.type !== 'url') ids.add(embedding.id)
          }

          if (embedding.type === 'file') {
            childText.set(node, '[[添付ファイル]]')
          } else if (
            embedding.type === 'message' &&
            node.data.form === 'linkify'
          ) {
            childText.set(node, '[[引用メッセージ]]')
          }
        }
      }

      if (node.children) visit(node.children)
    }
  }

  visit(document.children)
  const omittedNodes = trailingNodesToOmit(document.children, links)
  return {
    roots: document.children.filter(node => !omittedNodes.has(node)),
    omittedNodes,
    childText,
    embeddings
  }
}

/** Whether the final paragraph ends with an embedding on a line of its own. */
export function endsWithEmbedding(document: Document, origin: string): boolean {
  const blocks = document.children.filter(node => node.kind !== trap.BlankLine)

  const paragraph = blocks.at(-1)

  if (paragraph?.kind !== names.Paragraph) {
    return false
  }

  const children = paragraph.children ?? []
  const last = children.at(-1)
  const previous = children.at(-2)

  if (
    !last ||
    !isStandaloneLink(last, previous) ||
    !isKnownNode(last) ||
    last.kind !== names.Link
  ) {
    return false
  }

  return embeddingFromUrl(last.data.destination, origin) !== undefined
}
