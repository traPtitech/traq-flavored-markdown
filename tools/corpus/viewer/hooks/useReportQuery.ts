import { useEffect, useMemo, useState } from 'react'

import type { Progress, Query, QueryResult } from '../data/query.ts'
import type { ReportRepository } from '../data/repository.ts'

export type QueryState =
  | { status: 'loading'; progress?: Progress }
  | { status: 'ready'; result: QueryResult }
  | { status: 'failed'; message: string }

export function useReportQuery(
  repository: ReportRepository,
  query: Query
): QueryState {
  const { profile, search, ignoreWhitespace, page } = query
  const request = useMemo(
    () => ({ profile, search, ignoreWhitespace, page }),
    [profile, search, ignoreWhitespace, page]
  )
  const [state, setState] = useState<{
    repository: ReportRepository
    request: Query
    value: QueryState
  }>()
  useEffect(() => {
    const controller = new AbortController()
    const publish = (value: QueryState) => {
      if (!controller.signal.aborted) setState({ repository, request, value })
    }
    void repository
      .query(request, controller.signal, progress =>
        publish({ status: 'loading', progress })
      )
      .then(result => publish({ status: 'ready', result }))
      .catch(error =>
        publish({
          status: 'failed',
          message: error instanceof Error ? error.message : String(error)
        })
      )
    return () => controller.abort()
  }, [repository, request])
  return state?.repository === repository && state.request === request
    ? state.value
    : { status: 'loading' }
}
