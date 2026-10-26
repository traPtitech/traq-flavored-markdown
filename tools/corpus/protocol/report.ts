import { validAuthorKinds } from './authors.ts'
import {
  byProfile,
  parseDifferenceRow,
  profileIds,
  profileResultSchema,
  runSummarySchema
} from './comparison.ts'
import {
  type Infer,
  array,
  count,
  keyedRecord,
  object,
  parse,
  positiveCount,
  string
} from './schema.ts'

export { byProfile, profileIds, parseDifferenceRow }
export type {
  DifferenceRow,
  ProfileId,
  OutputKind,
  Timing
} from './comparison.ts'
export const pageSize = 50
const outputDifferenceFilters = {
  whitespace: 1,
  case: 2,
  whitespaceAndCase: 4,
  linkedImages: 8,
  whitespaceAndLinkedImages: 16,
  caseAndLinkedImages: 32,
  whitespaceAndCaseAndLinkedImages: 64,
  htmlSerialization: 128,
  whitespaceAndHtmlSerialization: 256,
  caseAndHtmlSerialization: 512,
  whitespaceAndCaseAndHtmlSerialization: 1024,
  linkedImagesAndHtmlSerialization: 2048,
  whitespaceAndLinkedImagesAndHtmlSerialization: 4096,
  caseAndLinkedImagesAndHtmlSerialization: 8192,
  whitespaceAndCaseAndLinkedImagesAndHtmlSerialization: 16384
} as const
const existingDifferenceFilters = {
  ...(Object.fromEntries(
    Object.entries(outputDifferenceFilters).map(([name, mask]) => [
      name,
      BigInt(mask)
    ])
  ) as Record<keyof typeof outputDifferenceFilters, bigint>),
  katexErrors: 1n << 15n,
  ...(Object.fromEntries(
    Object.entries(outputDifferenceFilters).map(([name, mask]) => [
      `${name}AndKatexErrors`,
      BigInt(mask) << 16n
    ])
  ) as Record<`${keyof typeof outputDifferenceFilters}AndKatexErrors`, bigint>)
}
export const differenceFilters = {
  ...existingDifferenceFilters,
  linkPolicy: 1n << 31n,
  ...(Object.fromEntries(
    Object.entries(existingDifferenceFilters).map(([name, mask]) => [
      `${name}AndLinkPolicy`,
      mask << 32n
    ])
  ) as Record<`${keyof typeof existingDifferenceFilters}AndLinkPolicy`, bigint>)
}
/** Sixteen hex digits per row record equality for all 63 filter combinations. */
export const filterMaskWidth = 16
export const encodeFilterMasks = (masks: readonly bigint[]) =>
  masks.map(mask => mask.toString(16).padStart(filterMaskWidth, '0')).join('')
export const filterMaskAt = (encoded: string, index: number) =>
  BigInt(
    '0x' + encoded.slice(index * filterMaskWidth, (index + 1) * filterMaskWidth)
  )
export const metadataSchema = object('ReportMetadata', {
  messages: count,
  counts: keyedRecord(count, profileIds),
  filters: keyedRecord(string, profileIds),
  authors: keyedRecord(string, profileIds),
  results: keyedRecord(profileResultSchema, profileIds),
  run: runSummarySchema,
  generated: string,
  pageSize: positiveCount
})
export type ReportMetadata = Infer<typeof metadataSchema>
const payloadSchema = keyedRecord(array(string), profileIds)
export type ReportPayload = Infer<typeof payloadSchema>
export type ReportData = { metadata: ReportMetadata; payload: ReportPayload }

export function parseReport(metadata: unknown, payload: unknown): ReportData {
  const meta = parse(metadataSchema, metadata)
  const chunks = parse(payloadSchema, payload)
  if (!Number.isFinite(Date.parse(meta.generated)))
    throw new Error('Invalid report date')
  for (const profile of profileIds) {
    const result = meta.results[profile]
    if (
      meta.filters[profile].length !== meta.counts[profile] * filterMaskWidth ||
      !/^(?:[0-7][0-9a-f]{15})*$/.test(meta.filters[profile]) ||
      meta.authors[profile].length !== meta.counts[profile] ||
      !validAuthorKinds(meta.authors[profile]) ||
      chunks[profile].length !== Math.ceil(meta.counts[profile] / meta.pageSize)
    )
      throw new Error('Invalid report profile: ' + profile)
    if (result.differences !== meta.counts[profile])
      throw new Error('Report counts mismatch')
    if (result.messages !== meta.messages)
      throw new Error('Report message counts mismatch')
    if (result.actualWarmups > meta.run.warmups)
      throw new Error('Report warmup counts mismatch')
    for (const field of [
      'differences',
      'embeddingDifferences',
      'beforeErrors',
      'afterErrors'
    ] as const)
      if (result[field] > result.messages)
        throw new Error('Invalid report counts')
    for (const side of ['before', 'after'] as const)
      if (result[side].calls !== meta.messages)
        throw new Error('Report timing counts mismatch')
  }
  return { metadata: meta, payload: chunks }
}
