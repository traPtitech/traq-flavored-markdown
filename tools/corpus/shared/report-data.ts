import {
  type ReportMetadata,
  type ReportPayload,
  modes
} from '../report-schema.ts'
import { validateProvenance } from './comparison.ts'

export type ReportData = { metadata: ReportMetadata; payload: ReportPayload }

export function parseReport(metadata: unknown, payload: unknown): ReportData {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !payload ||
    typeof payload !== 'object'
  )
    throw new Error('Missing report data')
  const meta = metadata as ReportMetadata,
    chunks = payload as ReportPayload
  if (
    !Number.isSafeInteger(meta.messages) ||
    meta.messages < 0 ||
    !Number.isSafeInteger(meta.pageSize) ||
    meta.pageSize <= 0 ||
    !Number.isFinite(Date.parse(meta.generated))
  )
    throw new Error('Invalid report metadata')
  for (const mode of modes) {
    if (
      !Number.isSafeInteger(meta.counts?.[mode]) ||
      meta.counts[mode] < 0 ||
      typeof meta.filters?.[mode] !== 'string' ||
      meta.filters[mode].length !== meta.counts[mode] ||
      !/^[01]*$/.test(meta.filters[mode]) ||
      !Array.isArray(chunks[mode]) ||
      chunks[mode].length !== Math.ceil(meta.counts[mode] / meta.pageSize) ||
      !chunks[mode].every(chunk => typeof chunk === 'string')
    )
      throw new Error('Invalid report mode: ' + mode)
    const result = meta.results?.[mode]
    if (result?.differences !== meta.counts[mode])
      throw new Error('Report counts mismatch')
    if (result.messages !== meta.messages)
      throw new Error('Report message counts mismatch')
    for (const field of [
      'differences',
      'embeddingDifferences',
      'beforeErrors',
      'afterErrors'
    ] as const)
      if (
        !Number.isSafeInteger(result[field]) ||
        result[field] < 0 ||
        result[field] > result.messages
      )
        throw new Error('Invalid report counts')
    for (const side of ['before', 'after'] as const)
      for (const field of [
        'totalMs',
        'meanUs',
        'p50Us',
        'p95Us',
        'p99Us'
      ] as const)
        if (!Number.isFinite(result[side]?.[field]) || result[side][field] < 0)
          throw new Error('Invalid report timing')
    for (const side of ['before', 'after'] as const)
      if (result[side].calls !== meta.messages)
        throw new Error('Report timing counts mismatch')
    if (
      ![result.initialization?.beforeMs, result.initialization?.afterMs].every(
        value => Number.isFinite(value) && value >= 0
      )
    )
      throw new Error('Invalid report initialization')
  }
  if (!Number.isSafeInteger(meta.run?.warmups) || meta.run.warmups < 0)
    throw new Error('Invalid report warmups')
  validateProvenance(meta.run.provenance)
  return { metadata: meta, payload: chunks }
}
