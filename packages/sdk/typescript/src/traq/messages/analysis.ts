import {
  definitions,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type {
  DocumentContext,
  DocumentSchema,
  ReadonlyDocument,
  ReadonlyNode
} from '@traq-flavored-markdown/core'
import { validateLink as defaultLinkPolicy } from '@traq-flavored-markdown/core/html'
import { names as traq } from '@traq-flavored-markdown/traq-plugin/nodes'

import { schema } from '../../generated/nodes.js'
import { resourceCardFromUrl } from './cards.js'
import type { ResourceCard } from './cards.js'

const messageSchema = schema.withUnknownNodes()

export function messageContext(
  document: ReadonlyDocument | DocumentContext,
  selectedSchema: DocumentSchema = messageSchema
) {
  return selectedSchema.document(document).withSchema(messageSchema)
}

export interface MessageLink {
  readonly card: ResourceCard
  readonly form: 'explicit' | 'autolink' | 'linkify'
}

/** Semantic targets; presentation overlays are built independently by each view. */
export interface MessageAnalysis {
  readonly context: DocumentContext
  readonly links: ReadonlyMap<ReadonlyNode, MessageLink>
  readonly cards: readonly ResourceCard[]
  readonly endsWithResourceCard: boolean
}

export function isStandaloneLink(
  node: ReadonlyNode,
  previous: ReadonlyNode | undefined,
  links: ReadonlyMap<ReadonlyNode, MessageLink>
): boolean {
  return (
    links.get(node)?.form === 'linkify' &&
    (!previous || previous.kind === names.Softbreak)
  )
}

/** Analyze each visible link once without making rendering choices. */
export function analyzeMessage(
  input: ReadonlyDocument | DocumentContext,
  origin: string,
  validateLink: (value: string) => boolean = defaultLinkPolicy
): MessageAnalysis {
  const context = messageContext(input)
  const links = new Map<ReadonlyNode, MessageLink>()
  const cards: ResourceCard[] = []
  const identities = new Set<string>()
  for (const node of context.walk(
    undefined,
    node => node.kind !== traq.Spoiler && node.kind !== names.Image
  )) {
    if (
      context.matches(node, definitions.Link) &&
      validateLink(node.data.destination)
    ) {
      const value = resourceCardFromUrl(node.data.destination, origin)
      if (!value) continue
      const card = Object.freeze(value)
      links.set(node, Object.freeze({ card, form: node.data.form }))
      const identity =
        card.type === 'url' ? undefined : `${card.type}:${card.id}`
      if (identity === undefined || !identities.has(identity)) {
        cards.push(card)
        if (identity !== undefined) identities.add(identity)
      }
    }
  }
  const blocks = context.document.children.filter(
    node => node.kind !== traq.BlankLine
  )
  const paragraph = blocks.at(-1)
  const children =
    paragraph?.kind === names.Paragraph ? (paragraph.children ?? []) : []
  const last = children.at(-1)
  return Object.freeze({
    context,
    links,
    cards: Object.freeze(cards),
    endsWithResourceCard:
      !!last && isStandaloneLink(last, children.at(-2), links)
  })
}

/** Uses the same semantic analysis as prepared message views. */
export function endsWithResourceCard(
  input: ReadonlyDocument | DocumentContext,
  origin: string,
  validateLink: (value: string) => boolean = defaultLinkPolicy
): boolean {
  return analyzeMessage(input, origin, validateLink).endsWithResourceCard
}
