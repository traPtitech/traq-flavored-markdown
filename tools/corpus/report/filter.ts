import { type DifferenceRow, isFailure } from '../protocol/comparison.ts'
import { differenceFilters } from '../protocol/report.ts'
import { normalizeHtmlSerialization } from './html.ts'
import { normalizeKatexErrors } from './katex.ts'

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
    mask |= differenceFilters.whitespace
  const beforeLower = before.toLowerCase()
  const afterLower = after.toLowerCase()
  if (beforeLower === afterLower) mask |= differenceFilters.case
  if (withoutWhitespace(beforeLower) === withoutWhitespace(afterLower))
    mask |= differenceFilters.whitespaceAndCase
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
      (imageBefore === imageAfter ? differenceFilters.linkedImages : 0) |
      (imageTextMask << 4) |
      (spellingMask << 7) |
      (imageSpellingMask << 11)
  )
}

export function differenceFilterMask(
  row: Pick<DifferenceRow, 'before' | 'after'>
) {
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
