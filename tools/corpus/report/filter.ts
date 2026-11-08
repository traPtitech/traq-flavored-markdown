import { type DifferenceRow, isFailure } from '../protocol/comparison.ts'
import {
  type FilterId,
  differenceFilters,
  filterSelectionBit
} from '../protocol/filters.ts'
import { normalizeHtmlSerialization } from './html.ts'
import { normalizeKatexErrors } from './katex.ts'
import { normalizeLinkPolicy } from './link-policy.ts'
import { normalizeNestedLinks } from './nested-links.ts'

const textFilters = {
  whitespace: Number(differenceFilters.whitespace),
  case: Number(differenceFilters.case),
  whitespaceAndCase: Number(differenceFilters.whitespaceAndCase),
  linkedImages: Number(differenceFilters.linkedImages)
}

const withoutWhitespace = (value: string) => value.replace(/[ \t\r\n\f]/g, '')

// Legacy image filtering turned [![alt](image)](page) into two links and
// literal brackets. Preserve the outer opening tag and the complete alt HTML;
// nested anchors are excluded so other reference/link changes remain visible.
export const normalizeLinkedImages = (value: string, inline = false) =>
  value.replace(
    /\[!<a\b[^>]*>((?:(?!<\/?a\b)[\s\S])*)<\/a>\]\((<a\b[^>]*>)(?:(?!<\/?a\b)[\s\S])*<\/a>\)/gi,
    (_match, label: string, opening: string) =>
      opening + (inline ? '' : '!') + label + '</a>'
  )

function textFilterMask(before: string, after: string) {
  let mask = 0

  if (withoutWhitespace(before) === withoutWhitespace(after)) {
    mask |= textFilters.whitespace
  }

  const beforeLower = before.toLowerCase()
  const afterLower = after.toLowerCase()
  if (beforeLower === afterLower) mask |= textFilters.case

  if (withoutWhitespace(beforeLower) === withoutWhitespace(afterLower)) {
    mask |= textFilters.whitespaceAndCase
  }

  return mask
}

function htmlFilterMask(before: string | undefined, after: string | undefined) {
  if (before === undefined || after === undefined) return 0

  return (before === after ? 1 : 0) | (textFilterMask(before, after) << 1)
}

function includeFilterSupersets(
  mask: number,
  combinations = filterSelectionBit('katexErrors')
) {
  // Adding a checkbox must not reveal rows excluded by an existing option,
  // even when the conservative HTML normalizer declines malformed input.
  for (let selected = 1; selected < combinations; selected++) {
    for (let option = 1; option < combinations; option <<= 1) {
      const subset = selected ^ option

      if (selected & option && subset && mask & (1 << (subset - 1))) {
        mask |= 1 << (selected - 1)
        break
      }
    }
  }

  return mask
}

function outputFilterMask({
  before,
  after
}: Pick<DifferenceRow, 'before' | 'after'>) {
  if (isFailure(before) || isFailure(after) || before.kind !== after.kind) {
    return 0
  }

  const mask = textFilterMask(before.value, after.value)

  const imageBefore =
    before.kind === 'html' ? normalizeLinkedImages(before.value) : before.value

  const imageAfter =
    after.kind === 'html' ? normalizeLinkedImages(after.value) : after.value

  const imageTextMask =
    imageBefore === before.value && imageAfter === after.value
      ? mask
      : textFilterMask(imageBefore, imageAfter)

  const htmlBefore =
    before.kind === 'html'
      ? normalizeHtmlSerialization(before.value)
      : before.value

  const htmlAfter =
    after.kind === 'html'
      ? normalizeHtmlSerialization(after.value)
      : after.value

  const imageHtmlBefore =
    imageBefore === before.value
      ? htmlBefore
      : normalizeHtmlSerialization(imageBefore)

  const imageHtmlAfter =
    imageAfter === after.value
      ? htmlAfter
      : normalizeHtmlSerialization(imageAfter)

  const spellingMask =
    htmlBefore === before.value && htmlAfter === after.value
      ? Number(before.value === after.value) | (mask << 1)
      : htmlFilterMask(htmlBefore, htmlAfter)

  const imageSpellingMask =
    imageHtmlBefore === htmlBefore && imageHtmlAfter === htmlAfter
      ? spellingMask
      : htmlFilterMask(imageHtmlBefore, imageHtmlAfter)

  return includeFilterSupersets(
    mask |
      (imageBefore === imageAfter ? textFilters.linkedImages : 0) |
      (imageTextMask << filterSelectionBit('linkedImages')) |
      (spellingMask << (filterSelectionBit('htmlSerialization') - 1)) |
      (imageSpellingMask <<
        (filterSelectionBit('htmlSerialization') +
          filterSelectionBit('linkedImages') -
          1))
  )
}

/** Extend the result table while preserving exclusions for every superset. */
function extendFilterMask(
  base: bigint,
  filter: FilterId,
  normalized?: { mask: bigint; equal: boolean }
) {
  const size = BigInt(filterSelectionBit(filter))
  let result = base | (base << size)

  if (normalized) {
    const additional = normalized.equal
      ? (1n << size) - 1n
      : normalized.mask << 1n

    result |= additional << (size - 1n)
  }

  return result
}

function diagnosticFilterMask(row: Pick<DifferenceRow, 'before' | 'after'>) {
  const base = BigInt(outputFilterMask(row))
  const { before, after } = row
  if (before.kind !== 'html' || after.kind !== 'html') {
    return extendFilterMask(base, 'katexErrors')
  }

  const left = normalizeKatexErrors(before.value)
  const right = normalizeKatexErrors(after.value)

  const normalized =
    left && right && left.errors > 0 && left.errors === right.errors
      ? {
          equal: left.value === right.value,
          mask: BigInt(
            outputFilterMask({
              before: { kind: 'html', value: left.value },
              after: { kind: 'html', value: right.value }
            })
          )
        }
      : undefined

  return extendFilterMask(base, 'katexErrors', normalized)
}

type FilterRow = Pick<DifferenceRow, 'before' | 'after'> &
  Partial<Pick<DifferenceRow, 'source' | 'profile'>>

function linkFilterMask(row: FilterRow, origin?: string) {
  const base = diagnosticFilterMask(row)
  const pair = normalizeLinkPolicy(row, origin)

  const normalized =
    pair && (pair.before !== row.before.value || pair.after !== row.after.value)
      ? {
          equal: pair.before === pair.after,
          mask: diagnosticFilterMask({
            before: { kind: row.before.kind, value: pair.before },
            after: { kind: row.after.kind, value: pair.after }
          })
        }
      : undefined

  return extendFilterMask(base, 'linkPolicy', normalized)
}

export function differenceFilterMask(row: FilterRow, origin?: string) {
  const base = linkFilterMask(row, origin)
  const pair = normalizeNestedLinks(row)

  const normalized = pair
    ? {
        equal: pair.before === pair.after,
        mask: linkFilterMask(
          {
            ...row,
            before: { kind: 'html', value: pair.before },
            after: { kind: 'html', value: pair.after }
          },
          origin
        )
      }
    : undefined

  return extendFilterMask(base, 'nestedLinks', normalized)
}
