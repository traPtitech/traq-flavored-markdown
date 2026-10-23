import {
  type ComparisonPlan,
  type ComparisonResult,
  type Mode,
  isMode
} from './shared/comparison.ts'

export {
  byMode,
  isMode,
  modes,
  type Mode,
  type Timing
} from './shared/comparison.ts'
export type OutputKind = 'html' | 'text' | 'error'

export const pageSize = 50

export type DifferenceRow = {
  index: number
  mode: Mode
  source: string
  before: string
  after: string
  beforeType: OutputKind
  afterType: OutputKind
  error?: boolean
}

export type ReportMetadata = {
  messages: number
  counts: Record<Mode, number>
  filters: Record<Mode, string>
  results: Record<Mode, ComparisonResult>
  run: Pick<ComparisonPlan, 'warmups' | 'provenance'>
  generated: string
  pageSize: number
}

export type ReportPayload = Record<Mode, string[]>

export function parseDifferenceRow(value: unknown): DifferenceRow {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid difference row')
  }
  const row = value as Record<string, unknown>
  if (
    !Number.isSafeInteger(row.index) ||
    (row.index as number) < 0 ||
    !isMode(row.mode) ||
    typeof row.source !== 'string' ||
    typeof row.before !== 'string' ||
    typeof row.after !== 'string' ||
    (row.error !== undefined && typeof row.error !== 'boolean') ||
    (row.beforeType !== undefined &&
      !['html', 'text', 'error'].includes(row.beforeType as string)) ||
    (row.afterType !== undefined &&
      !['html', 'text', 'error'].includes(row.afterType as string))
  ) {
    throw new Error('Invalid difference row')
  }
  const defaultType = row.error
    ? 'error'
    : row.mode === 'plainText'
      ? 'text'
      : 'html'
  return {
    ...row,
    beforeType: row.beforeType ?? defaultType,
    afterType: row.afterType ?? defaultType
  } as DifferenceRow
}
