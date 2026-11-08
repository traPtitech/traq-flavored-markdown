import { escapeText } from 'entities'

import type { ClassificationId } from '../protocol/classification.ts'
import type { DifferenceRow } from '../protocol/comparison.ts'
import { resourceLabel } from './link-policy/destinations.ts'
import { normalizeLinkHtml } from './link-policy/html.ts'
import { restoreResourceSuffix } from './link-policy/resources.ts'
import { collectLinkEvidence } from './link-policy/source.ts'
import { normalizeUrlFormatting } from './url-boundaries.ts'

type LinkRow = Pick<DifferenceRow, 'before' | 'after'> &
  Partial<Pick<DifferenceRow, 'source' | 'profile'>>

type LinkNormalization = {
  before: string
  after: string
  changes: readonly ClassificationId[]
}

/** Normalize only output changes supported by the original link notation. */
export function normalizeLinkPolicy(
  row: LinkRow,
  origin?: string
): LinkNormalization | undefined {
  const { source, before, after } = row
  if (
    !source ||
    before.kind !== after.kind ||
    before.kind === 'error' ||
    after.kind === 'error' ||
    (before.kind === 'text' && /`|~~~|\$/.test(source))
  ) {
    return undefined
  }

  const evidence = collectLinkEvidence(
    source,
    before.value,
    after.value,
    before.kind === 'html'
  )

  const { formOf, domains } = evidence

  if (before.kind === 'html') {
    if (
      !/<a\b/i.test(before.value + after.value) &&
      !domains.length &&
      (!origin || !source.includes(origin))
    ) {
      return undefined
    }

    // Identical anchors need no interpretation. Keeping them on both sides also
    // prevents an unrelated occurrence in literal HTML from being normalized
    // on only one side. Counts matter when a label occurs more than once.
    const right = normalizeLinkHtml(after.value, {
      evidence,
      side: 'after',
      origin
    })
    if (right === undefined) return undefined

    const left = normalizeLinkHtml(before.value, {
      evidence,
      side: 'before',
      origin,
      expectedLinks: right.linked
    })
    if (
      left === undefined ||
      domains.some(
        domain =>
          (right.forced.get(domain) ?? 0) <
          (left.forced.get(domain) ?? 0) + (left.angleText.get(domain) ?? 0)
      )
    ) {
      return undefined
    }

    const restored = restoreResourceSuffix(
      right.value,
      left.value,
      source,
      row.profile,
      origin
    )

    for (const [label, count] of left.linked) {
      if (
        (right.linked.get(label) ?? 0) < count &&
        !(restored !== right.value && restored.includes(escapeText(label)))
      ) {
        return undefined
      }
    }

    const normalized = normalizeUrlFormatting(
      source,
      left.value,
      restored,
      new Map([...left.urls, ...right.urls])
    )

    return normalized
      ? {
          ...normalized,
          changes: [...new Set([...left.changes, ...right.changes])]
        }
      : undefined
  }

  let left = before.value
  const right = after.value

  for (const domain of domains) {
    left = left.replaceAll(`<${domain}>`, domain)
  }

  let normalizedRight = right

  for (const match of source.matchAll(/(?<![:/\w])\/\/[^\s<>]+/g)) {
    const url = match[0]
    if (formOf(url) !== 'bare') continue

    const label = resourceLabel(url, origin)
    if (label) normalizedRight = normalizedRight.replace(`[${label}]`, url)
  }

  return { before: left, after: normalizedRight, changes: [] }
}
