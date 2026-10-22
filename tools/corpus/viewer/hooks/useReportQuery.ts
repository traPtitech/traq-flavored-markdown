import { useEffect, useState } from 'react'

import type { Progress, Query, QueryResult } from '../data/query.ts'
import type { ReportRepository } from '../data/repository.ts'

export type QueryState =
  | { status: 'idle' }
  | { status: 'loading'; progress?: Progress }
  | { status: 'ready'; result: QueryResult }
  | { status: 'failed'; message: string }
export function useReportQuery(
  repository: ReportRepository | null,
  query: Query
): QueryState {
  const key = JSON.stringify(query)
  const [state, setState] = useState<{ key: string; value: QueryState }>({
    key,
    value: { status: 'idle' }
  })
  useEffect(() => {
    if (!repository) return
    const controller = new AbortController()
    const current = JSON.parse(key) as Query
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return
      setState({ key, value: { status: 'loading' } })
      return repository
        .query(current, controller.signal, progress => {
          if (!controller.signal.aborted)
            setState({ key, value: { status: 'loading', progress } })
        })
        .then(result => {
          if (!controller.signal.aborted)
            setState({ key, value: { status: 'ready', result } })
        })
        .catch(error => {
          if (!controller.signal.aborted)
            setState({
              key,
              value: { status: 'failed', message: String(error) }
            })
        })
    })
    return () => controller.abort()
  }, [repository, key])
  return state.key === key ? state.value : { status: 'loading' }
}
