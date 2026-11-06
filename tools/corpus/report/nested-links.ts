import { decodeHTML } from 'entities'
import { type Token, Tokenizer } from 'parse5'

import type { DifferenceRow } from '../protocol/comparison.ts'

type Edit = { start: number; end: number; value: string }
type Anchor = {
  opening: Token.TagToken
  closing: Token.TagToken
  outer?: Token.TagToken
}
const voidElements = new Set(
  'area base br col embed hr img input link meta param source track wbr'.split(
    ' '
  )
)
const literalElements = new Set([
  'code',
  'pre',
  'textarea',
  'title',
  'template'
])
const unsupportedElements = new Set(
  'script style listing xmp iframe noembed noframes plaintext svg math'.split(
    ' '
  )
)
const attribute = (tag: Token.TagToken, name: string) =>
  tag.attrs.find(value => value.name === name)?.value
const outerAnchors = (value: Anchor[]) =>
  value
    .filter(anchor => !anchor.outer)
    .sort(
      (left, right) =>
        left.opening.location!.startOffset - right.opening.location!.startOffset
    )

// Read the authored tag nesting, before the HTML parser repairs nested anchors
// into siblings. Tokenization respects quoted attributes and HTML comments.
// Reject unbalanced tags and raw/foreign HTML rather than guessing at repairs.
function anchors(html: string): Anchor[] | undefined {
  const stack: {
    tag: Token.TagToken
    literal: boolean
    outer?: Token.TagToken
  }[] = []
  const result: Anchor[] = []
  let invalid = false
  new Tokenizer(
    { sourceCodeLocationInfo: true },
    {
      onStartTag(tag) {
        if (unsupportedElements.has(tag.tagName)) invalid = true
        if (voidElements.has(tag.tagName)) return
        if (tag.selfClosing) invalid = true
        const literal =
          Boolean(stack.at(-1)?.literal) || literalElements.has(tag.tagName)
        const outer = !literal
          ? stack.find(entry => entry.tag.tagName === 'a' && !entry.literal)
              ?.tag
          : undefined
        stack.push({ tag, literal, outer })
      },
      onEndTag(tag) {
        const entry = stack.pop()
        if (!entry || entry.tag.tagName !== tag.tagName) {
          invalid = true
          return
        }
        if (tag.tagName === 'a' && !entry.literal) {
          if (attribute(entry.tag, 'href') === undefined) invalid = true
          result.push({ opening: entry.tag, closing: tag, outer: entry.outer })
        }
      },
      onComment() {},
      onDoctype() {
        invalid = true
      },
      onEof() {},
      onCharacter() {},
      onWhitespaceCharacter() {},
      onNullCharacter() {
        invalid = true
      },
      onParseError() {
        invalid = true
      }
    }
  ).write(html, true)
  return invalid || stack.length ? undefined : result
}

function applyEdits(html: string, edits: Edit[]) {
  edits.sort((left, right) => left.start - right.start)
  const parts: string[] = []
  let end = 0
  for (const edit of edits) {
    if (edit.start < end) return undefined
    parts.push(html.slice(end, edit.start), edit.value)
    end = edit.end
  }
  parts.push(html.slice(end))
  return parts.join('')
}

/** Keep the outer destination and the exact rich label; remove inner anchors. */
export function normalizeNestedLinks(
  row: Pick<DifferenceRow, 'before' | 'after'> &
    Partial<Pick<DifferenceRow, 'source'>>
) {
  if (row.before.kind !== 'html' || row.after.kind !== 'html') return undefined
  const sides = [row.before.value, row.after.value]
  // Avoid tokenizing the overwhelmingly common messages with no nested links.
  if (!sides.some(html => (html.match(/<a\s/gi)?.length ?? 0) > 1))
    return undefined
  const parsed = sides.map(anchors)
  if (parsed.some(value => !value)) return undefined
  const hasNested = parsed.map(value => value!.some(anchor => anchor.outer))
  // A changed inner URL while both sides still contain nested anchors is a
  // separate change; this checkbox only accepts their complete removal.
  if (hasNested[0] === hasNested[1]) return undefined
  const projections: {
    href: string
    occurrence: number
    literal: string
    label: string
  }[] = []
  const result = sides.map((html, index) => {
    const edits: Edit[] = []
    for (const anchor of parsed[index]!) {
      if (!anchor.outer) continue
      const opening = anchor.opening.location!
      const closing = anchor.closing.location!
      edits.push(
        { start: opening.startOffset, end: opening.endOffset, value: '' },
        { start: closing.startOffset, end: closing.endOffset, value: '' }
      )
      // Older captured candidates used the reference JSON as an image label.
      // Project it only when the source and the removed reference anchor prove
      // the same ID, label, and outer destination. Other label changes survive.
      const label = html.slice(opening.endOffset, closing.startOffset)
      const classes = attribute(anchor.opening, 'class')?.split(/\s+/) ?? []
      for (const match of row.source?.matchAll(/!\{[^\n]*?\}/g) ?? []) {
        try {
          const reference = JSON.parse(match[0].slice(1)) as {
            type?: string
            id?: string
            raw?: string
          }
          const prefix = { channel: 'c', user: 'u', group: 'g' }[
            reference.type as 'channel' | 'user' | 'group'
          ]
          if (
            prefix &&
            typeof reference.id === 'string' &&
            typeof reference.raw === 'string' &&
            !label.includes('<') &&
            decodeHTML(label) === reference.raw &&
            classes.includes(`message-${reference.type}-link`) &&
            attribute(anchor.opening, 'href') ===
              `#${prefix}-${encodeURIComponent(reference.id)}`
          )
            projections.push({
              href: attribute(anchor.outer, 'href')!,
              occurrence: outerAnchors(parsed[index]!)
                .filter(
                  value =>
                    attribute(value.opening, 'href') ===
                    attribute(anchor.outer!, 'href')
                )
                .findIndex(value => value.opening === anchor.outer),
              literal: match[0],
              label
            })
        } catch {
          /* Ambiguous or malformed references stay visible. */
        }
      }
    }
    return applyEdits(html, edits)
  })
  if (result.some(value => value === undefined)) return undefined
  const projected = result.map(html => {
    const edits: Edit[] = []
    const occurrences = new Map<string, number>()
    for (const anchor of outerAnchors(anchors(html!) ?? [])) {
      const href = attribute(anchor.opening, 'href')!
      const occurrence = occurrences.get(href) ?? 0
      occurrences.set(href, occurrence + 1)
      const opening = anchor.opening.location!
      const closing = anchor.closing.location!
      const body = html!.slice(opening.endOffset, closing.startOffset)
      if (body.includes('<')) continue
      const projection = projections.find(
        value =>
          value.href === href &&
          value.occurrence === occurrence &&
          value.literal === decodeHTML(body)
      )
      if (projection)
        edits.push({
          start: opening.endOffset,
          end: closing.startOffset,
          value: projection.label
        })
    }
    return applyEdits(html!, edits)
  })
  return projected[0] === undefined || projected[1] === undefined
    ? undefined
    : { before: projected[0], after: projected[1] }
}
