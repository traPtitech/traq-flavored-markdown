import type {
  Classification,
  ClassificationSelection
} from '../../protocol/classification.ts'
import type { FilterQuery } from '../../protocol/filters.ts'
import type { DifferenceRow, ProfileId } from '../../protocol/report.ts'

export type Query = FilterQuery & {
  profile: ProfileId
  search: string
  excludeBots: boolean
  page: number
  category?: ClassificationSelection
  onlyReview?: boolean
}

export type ClassificationCounts = Record<
  string,
  { total: number; review: number }
>

export type QueryResult = {
  rows: DifferenceRow[]
  totalHits: number
  totalPages: number
  page: number
  filtered: boolean
  classifications: Classification[]
  classificationCounts: ClassificationCounts
}

export type Progress = { done: number; total: number }

export function normalizePage(page: number, totalPages: number) {
  return Math.min(
    Math.max(1, totalPages),
    Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1)
  )
}
