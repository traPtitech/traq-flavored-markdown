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
export const metadataSchema = object('ReportMetadata', {
  messages: count,
  counts: keyedRecord(count, profileIds),
  filters: keyedRecord(string, profileIds),
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
      meta.filters[profile].length !== meta.counts[profile] ||
      !/^[01]*$/.test(meta.filters[profile]) ||
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
