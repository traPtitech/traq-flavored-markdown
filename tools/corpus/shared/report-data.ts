import {
  type ReportMetadata,
  type ReportPayload,
  modes
} from '../report-schema.ts'

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
    const timing = mode === 'plainText' ? meta.traq : meta.sui?.modes?.[mode]
    if (timing?.differences !== meta.counts[mode])
      throw new Error('Report counts mismatch')
    for (const side of ['before', 'after'] as const)
      for (const field of ['meanUs', 'p50Us', 'p95Us'] as const)
        if (
          !Number.isFinite(timing?.[side]?.[field]) ||
          timing[side][field] < 0
        )
          throw new Error('Invalid report timing')
  }
  if (
    meta.sui.messages !== meta.messages ||
    meta.traq.messages !== meta.messages
  )
    throw new Error('Report message counts mismatch')
  if (
    !meta.revisions ||
    !['suiMaster', 'traqMaster', 'renderer', 'processor'].every(
      key => typeof meta.revisions[key] === 'string'
    ) ||
    ![
      meta.sui.beforeInitializationMs,
      meta.sui.afterInitializationMs,
      meta.traq.afterInitializationMs
    ].every(value => Number.isFinite(value) && value >= 0)
  )
    throw new Error('Invalid report provenance')
  return { metadata: meta, payload: chunks }
}
