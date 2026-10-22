import {
  type DifferenceRow,
  type Mode,
  type ReportMetadata,
  type ReportPayload,
  byMode,
  modes,
  pageSize
} from '../report-schema.ts'
import { ignoreMask } from '../scripts/ignore-differences.ts'
import { parseReport } from '../shared/report-data.ts'

export async function aggregateDifferences(
  rows: AsyncIterable<DifferenceRow>,
  size = pageSize
) {
  if (!Number.isSafeInteger(size) || size <= 0)
    throw new Error('Invalid report page size')
  const filterMasks = byMode<number[]>(() => []),
    payload: ReportPayload = byMode<string[]>(() => []),
    pending = byMode<DifferenceRow[]>(() => []),
    counts = byMode(() => 0)
  const flush = (mode: Mode) => {
    if (!pending[mode].length) return
    payload[mode].push(
      Bun.gzipSync(JSON.stringify(pending[mode]), { level: 9 }).toBase64()
    )
    pending[mode] = []
  }
  for await (const row of rows) {
    if (row.before === row.after && row.beforeType === row.afterType)
      throw new Error('Equal result in difference list')
    filterMasks[row.mode].push(ignoreMask(row))
    pending[row.mode].push(row)
    counts[row.mode]++
    if (pending[row.mode].length === size) flush(row.mode)
  }
  for (const mode of modes) flush(mode)
  const filters = byMode(() => ''),
    excluded = byMode(() => ({ whitespace: 0 }))
  for (const mode of modes) {
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
