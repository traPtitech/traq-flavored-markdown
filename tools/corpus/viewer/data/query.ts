import type { DifferenceRow, Mode } from '../../report-schema.ts'

export type Query = {
  mode: Mode
  search: string
  ignoreWhitespace: boolean
  page: number
}
export type QueryResult = {
  rows: DifferenceRow[]
  totalHits: number
  totalPages: number
  page: number
  filtered: boolean
}
export type Progress = { done: number; total: number }

export function normalizePage(page: number, totalPages: number) {
  return Math.min(
    Math.max(1, totalPages),
    Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1)
  )
}
