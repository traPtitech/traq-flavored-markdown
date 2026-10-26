import type { DifferenceRow, ProfileId } from '../../protocol/report.ts'

export type Query = {
  profile: ProfileId
  search: string
  ignoreWhitespace: boolean
  ignoreCase: boolean
  ignoreLinkedImages: boolean
  ignoreHtmlSerialization: boolean
  ignoreKatexErrors: boolean
  excludeBots: boolean
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
