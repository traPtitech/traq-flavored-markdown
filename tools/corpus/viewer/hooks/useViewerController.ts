import { useReducer } from 'react'

import type { ReportRepository } from '../data/repository.ts'
import { initialViewerState, viewerReducer } from '../state.ts'
import { useReportQuery } from './useReportQuery.ts'

export function useViewerController(repository: ReportRepository | null) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState)
  const response = useReportQuery(repository, state.query)
  const result = response.status === 'ready' ? response.result : undefined
  const totalHits =
    result?.totalHits ?? repository?.metadata.counts[state.query.mode] ?? 0
  const totalPages = result?.totalPages ?? 1
  const loading = response.status === 'loading' || response.status === 'idle'
  return {
    state,
    dispatch,
    response,
    result,
    totalHits,
    totalPages,
    loading,
    selectPage(page: number) {
      dispatch({ type: 'page', page, totalPages })
    }
  }
}

export type ViewerController = ReturnType<typeof useViewerController>
