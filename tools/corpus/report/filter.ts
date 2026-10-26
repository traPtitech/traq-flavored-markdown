import { type DifferenceRow, isFailure } from '../protocol/comparison.ts'
import { normalizeHtmlSerialization } from './html.ts'
import { normalizeKatexErrors } from './katex.ts'
import { normalizeLinkPolicy } from './link-policy.ts'

const textFilters = {
  whitespace: 1,
  case: 2,
  whitespaceAndCase: 4,
  linkedImages: 8
}

const withoutWhitespace = (value: string) => value.replace(/[ \t\r\n\f]/g, '')

// Legacy image filtering turned [![alt](image)](page) into two links and
// literal brackets. Preserve the outer opening tag and the complete alt HTML;
// nested anchors are excluded so other reference/link changes remain visible.
const normalizeLinkedImages = (value: string) =>
  value.replace(
    /\[!<a\b[^>]*>((?:(?!<\/?a\b)[\s\S])*)<\/a>\]\((<a\b[^>]*>)(?:(?!<\/?a\b)[\s\S])*<\/a>\)/gi,
    (_match, label: string, opening: string) => opening + '!' + label + '</a>'
  )

function textFilterMask(before: string, after: string) {
  let mask = 0
  if (withoutWhitespace(before) === withoutWhitespace(after))
    mask |= textFilters.whitespace
  const beforeLower = before.toLowerCase()
  const afterLower = after.toLowerCase()
  if (beforeLower === afterLower) mask |= textFilters.case
  if (withoutWhitespace(beforeLower) === withoutWhitespace(afterLower))
    mask |= textFilters.whitespaceAndCase
  return mask
}

function htmlFilterMask(before: string | undefined, after: string | undefined) {
  if (before === undefined || after === undefined) return 0
  return (before === after ? 1 : 0) | (textFilterMask(before, after) << 1)
}

function includeFilterSupersets(mask: number, combinations = 16) {
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
  if (isFailure(before) || isFailure(after) || before.kind !== after.kind)
    return 0
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
      (imageTextMask << 4) |
      (spellingMask << 7) |
      (imageSpellingMask << 11)
  )
}

function existingFilterMask(row: Pick<DifferenceRow, 'before' | 'after'>) {
  const mask = outputFilterMask(row)
  const { before, after } = row
  if (before.kind !== 'html' || after.kind !== 'html')
    return includeFilterSupersets(mask, 32)
  const left = normalizeKatexErrors(before.value)
  const right = normalizeKatexErrors(after.value)
  let katexMask = 0
  if (left && right && left.errors > 0 && left.errors === right.errors) {
    katexMask =
      (left.value === right.value ? 1 : 0) |
      (outputFilterMask({
        before: { kind: 'html', value: left.value },
        after: { kind: 'html', value: right.value }
      }) <<
        1)
  }
  return includeFilterSupersets(mask | (katexMask << 15), 32)
}

export function differenceFilterMask(
  row: Pick<DifferenceRow, 'before' | 'after'> &
    Partial<Pick<DifferenceRow, 'source' | 'profile'>>,
  origin?: string
) {
  const existing = BigInt(existingFilterMask(row))
  // Existing exclusions also apply when the new checkbox is selected.
  let mask = existing | (existing << 32n)
  const normalized = normalizeLinkPolicy(row, origin)
  if (
    normalized &&
    (normalized.before !== row.before.value ||
      normalized.after !== row.after.value)
  ) {
    const linkMask =
      normalized.before === normalized.after
        ? 0xffffffffn
        : BigInt(
            existingFilterMask({
              before: { kind: row.before.kind, value: normalized.before },
              after: { kind: row.after.kind, value: normalized.after }
            })
          ) << 1n
    mask |= linkMask << 31n
  }
  return mask
}
