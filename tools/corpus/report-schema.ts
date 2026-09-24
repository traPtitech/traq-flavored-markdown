export const modes = ['render', 'inline', 'plainText'] as const
export type Mode = (typeof modes)[number]

export const pageSize = 50

export const byMode = <T>(create: () => T): Record<Mode, T> => ({
  render: create(),
  inline: create(),
  plainText: create()
})

export type DifferenceRow = {
  index: number
  mode: Mode
  source: string
  before: string
  after: string
  error?: boolean
}

export type Timing = {
  meanUs: number
  p50Us: number
  p95Us: number
}

type Comparison = { before: Timing; after: Timing }

export type ReportMetadata = {
  messages: number
  counts: Record<Mode, number>
  filters: Record<Mode, string>
  sui: {
    messages: number
    modes: Record<'render' | 'inline', Comparison & { differences: number }>
    beforeInitializationMs: number
    afterInitializationMs: number
  }
  traq: Comparison & {
    messages: number
    differences: number
    afterInitializationMs: number
  }
  revisions: Record<string, string>
  generated: string
  pageSize: number
}

export type ReportPayload = Record<Mode, string[]>

export function isMode(value: unknown): value is Mode {
  return modes.some(mode => mode === value)
}

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
    (row.error !== undefined && typeof row.error !== 'boolean')
  ) {
    throw new Error('Invalid difference row')
  }
  return row as DifferenceRow
}
