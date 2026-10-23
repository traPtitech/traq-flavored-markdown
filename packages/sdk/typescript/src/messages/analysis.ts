import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { validateLink as defaultLinkPolicy } from '@traq-flavored-markdown/commonmark-plugin/policy'
import { DocumentContext } from '@traq-flavored-markdown/core'
import type { Document, Node } from '@traq-flavored-markdown/core/renderer'
import { names as trap } from '@traq-flavored-markdown/traq-plugin/nodes'

import { definitions } from '../generated/nodes.js'
import { resourceCardFromUrl } from './cards.js'
import type { ResourceCard } from './cards.js'
import { resourceLabels } from './labels.js'

const builtinNodes = Object.values(definitions)

export function messageContext(document: Document | DocumentContext) {
  const context =
    document instanceof DocumentContext
      ? document
      : new DocumentContext(document, { definitions: builtinNodes })
  context.validateDefinitions(builtinNodes)
  return context
}

function trailingNodesToOmit(
  children: readonly Node[],
  links: ReadonlyMap<Node, ResourceCard>
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
    const card = links.get(node)

    if (node.kind === names.Softbreak) {
      end--
      continue
    }

    if (card && card.type !== 'url' && isStandaloneLink(node, previous)) {
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
export function analyzeMessage(
  input: DocumentContext,
  origin: string,
  validateLink: (value: string) => boolean = defaultLinkPolicy
) {
  const context = messageContext(input)
  const document = context.document
  const links = new Map<Node, ResourceCard>()
  const cards: ResourceCard[] = []
  const childText = new Map<Node, string>()
  const ids = new Set<string>()

  for (const node of context.walk(
    undefined,
    node => node.kind !== trap.Spoiler && node.kind !== names.Image
  )) {
    if (node.kind === trap.Spoiler || node.kind === names.Image) continue

    if (
      isKnownNode(node) &&
      node.kind === names.Link &&
      validateLink(node.data.destination)
    ) {
      const card = resourceCardFromUrl(node.data.destination, origin)
      if (card) {
        links.set(node, card)
        const identity =
          card.type === 'url' ? undefined : `${card.type}:${card.id}`
        if (identity === undefined || !ids.has(identity)) {
          cards.push(card)
          if (identity !== undefined) ids.add(identity)
        }

        if (card.type === 'file') {
          childText.set(node, resourceLabels.file)
        } else if (card.type === 'message' && node.data.form === 'linkify') {
          childText.set(node, resourceLabels.message)
        }
      }
    }
  }
  const omittedNodes = trailingNodesToOmit(document.children, links)
  return {
    roots: document.children.filter(node => !omittedNodes.has(node)),
    omittedNodes,
    childText,
    cards
  }
}

/** Whether the final paragraph ends with a card on a line of its own. */
export function endsWithResourceCard(
  input: Document | DocumentContext,
  origin: string,
  validateLink: (value: string) => boolean = defaultLinkPolicy
): boolean {
  const document = messageContext(input).document
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

  return (
    validateLink(last.data.destination) &&
    resourceCardFromUrl(last.data.destination, origin) !== undefined
  )
}
