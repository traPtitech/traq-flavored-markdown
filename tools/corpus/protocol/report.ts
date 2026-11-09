import { validAuthorKinds } from './authors.ts'
import {
  classificationVersion,
  validClassifications
} from './classification.ts'
import {
  byProfile,
  frontendProfileIds,
  parseDifferenceRow,
  profileIds,
  profileResultSchema,
  profilesFor,
  runSummarySchema
} from './comparison.ts'
import { validFilterMasks } from './filters.ts'
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

export {
  differenceFilters,
  encodeFilterMasks,
  filterMaskAt,
  filterMaskWidth
} from './filters.ts'

export { byProfile, profileIds, profilesFor, parseDifferenceRow }

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
  authors: keyedRecord(string, profileIds),
  results: keyedRecord(profileResultSchema, frontendProfileIds, ['plainText']),
  run: runSummarySchema,
  generated: string,
  classificationVersion: string,
  classifications: keyedRecord(string, profileIds),
  pageSize: positiveCount
})

export type ReportMetadata = Infer<typeof metadataSchema>
const payloadSchema = keyedRecord(array(string), profileIds)
export type ReportPayload = Infer<typeof payloadSchema>
export type ReportData = { metadata: ReportMetadata; payload: ReportPayload }

export function parseReport(metadata: unknown, payload: unknown): ReportData {
  const meta = parse(metadataSchema, metadata)
  const chunks = parse(payloadSchema, payload)

  if (meta.classificationVersion !== classificationVersion) {
    throw new Error('Unsupported classification version; regenerate the report')
  }

  if (!Number.isFinite(Date.parse(meta.generated))) {
    throw new Error('Invalid report date')
  }

  const selected = profilesFor(meta.run)
  if (
    Object.keys(meta.results).length !== selected.length ||
    selected.some(profile => !meta.results[profile])
  ) {
    throw new Error('Report profiles mismatch')
  }

  for (const profile of profileIds) {
    const result = meta.results[profile]

    if (
      !validFilterMasks(meta.filters[profile], meta.counts[profile]) ||
      meta.authors[profile].length !== meta.counts[profile] ||
      !validAuthorKinds(meta.authors[profile]) ||
      !validClassifications(
        meta.classifications[profile],
        meta.counts[profile]
      ) ||
      chunks[profile].length !== Math.ceil(meta.counts[profile] / meta.pageSize)
    ) {
      throw new Error('Invalid report profile: ' + profile)
    }

    if (!result) {
      if (meta.counts[profile] !== 0) {
        throw new Error(
          'Uncompared report profile contains differences: ' + profile
        )
      }

      continue
    }

    if (result.differences !== meta.counts[profile]) {
      throw new Error('Report counts mismatch')
    }

    if (result.messages !== meta.messages) {
      throw new Error('Report message counts mismatch')
    }

    if (result.actualWarmups > meta.run.warmups) {
      throw new Error('Report warmup counts mismatch')
    }

    for (const field of [
      'differences',
      'embeddingDifferences',
      'beforeErrors',
      'afterErrors'
    ] as const) {
      if (result[field] > result.messages) {
        throw new Error('Invalid report counts')
      }
    }

    for (const side of ['before', 'after'] as const) {
      if (result[side].calls !== meta.messages) {
        throw new Error('Report timing counts mismatch')
      }
    }
  }

  return { metadata: meta, payload: chunks }
}
