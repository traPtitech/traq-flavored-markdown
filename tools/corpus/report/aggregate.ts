import {
  type DifferenceRow,
  type ProfileId,
  type ReportMetadata,
  type ReportPayload,
  byProfile,
  pageSize,
  profileIds
} from '../protocol/report.ts'
import { parseReport } from '../protocol/report.ts'
import { isWhitespaceOnlyDifference } from './filter.ts'

export async function aggregateDifferences(
  rows: AsyncIterable<DifferenceRow>,
  size = pageSize
) {
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new Error('Invalid report page size')
  const filterMasks = byProfile<number[]>(() => []),
    payload: ReportPayload = byProfile<string[]>(() => []),
    pending = byProfile<DifferenceRow[]>(() => []),
    counts = byProfile(() => 0)
  const flush = (mode: ProfileId) => {
    if (!pending[mode].length) return
    payload[mode].push(
      Bun.gzipSync(JSON.stringify(pending[mode]), { level: 9 }).toBase64()
    )
    pending[mode] = []
  }
  for await (const row of rows) {
    if (
      row.before.value === row.after.value &&
      row.before.kind === row.after.kind
    )
      throw new Error('Equal result in difference list')
    filterMasks[row.profile].push(Number(isWhitespaceOnlyDifference(row)))
    pending[row.profile].push(row)
    counts[row.profile]++
    if (pending[row.profile].length === size) flush(row.profile)
  }
  for (const mode of profileIds) flush(mode)
  const filters = byProfile(() => ''),
    excluded = byProfile(() => ({ whitespace: 0 }))
  for (const mode of profileIds) {
    filters[mode] = filterMasks[mode].join('')
    excluded[mode].whitespace = filterMasks[mode].filter(
      value => value & 1
    ).length
  }
  return { payload, counts, filters, excluded, pageSize: size }
}

export function reportDocument(
  template: string,
  metadata: ReportMetadata,
  payload: ReportPayload
) {
  parseReport(metadata, payload)
  let html = template
  for (const [id, value] of [
    ['metadata', metadata],
    ['payload', payload]
  ] as const) {
    const placeholder = `<script type="application/json" id="${id}"></script>`
    if (!html.includes(placeholder))
      throw new Error(`Missing ${id} placeholder in built viewer`)
    html = html.replace(
      placeholder,
      `<script type="application/json" id="${id}">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`
    )
  }
  return html
}
