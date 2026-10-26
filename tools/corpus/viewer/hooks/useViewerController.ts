import { useReducer } from 'react'

import type { ProfileId } from '../../protocol/report.ts'
import type { ReportRepository } from '../data/repository.ts'
import { type OutputView, initialViewerState, viewerReducer } from '../state.ts'
import { useReportQuery } from './useReportQuery.ts'

const number = (value: number) => value.toLocaleString('ja-JP')

export function useViewerController(repository: ReportRepository) {
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState)
  const response = useReportQuery(repository, state.query)
  const result = response.status === 'ready' ? response.result : undefined
  const totalHits =
    result?.totalHits ?? repository.metadata.counts[state.query.profile]
  const totalPages = result?.totalPages ?? 1
  const loading = response.status === 'loading'
  const status =
    response.status === 'failed'
      ? `読込エラー: ${response.message}`
      : response.status === 'loading'
        ? response.progress
          ? `検索 ${number(response.progress.done)} / ${number(response.progress.total)}`
          : '読込中…'
        : `${number(totalHits)} 件${result?.filtered ? ` / 全 ${number(repository.metadata.counts[state.query.profile])} 件` : ''}`
  return {
    rows: result?.rows ?? [],
    outputView: state.outputView,
    empty: response.status === 'ready' && totalHits === 0,
    controls: {
      counts: repository.metadata.counts,
      authors: repository.metadata.authors[state.query.profile],
      hasAuthorData: Object.values(repository.metadata.authors).some(authors =>
        /[bh]/.test(authors)
      ),
      query: state.query,
      searchDraft: state.searchDraft,
      outputView: state.outputView,
      status,
      loading,
      failed: response.status === 'failed',
      totalPages,
      onProfile: (profile: ProfileId) => dispatch({ type: 'profile', profile }),
      onSearchDraft: (text: string) => dispatch({ type: 'draft', text }),
      onSearch: () => dispatch({ type: 'search' }),
      onWhitespace: (ignore: boolean) =>
        dispatch({ type: 'whitespace', ignore }),
      onCase: (ignore: boolean) => dispatch({ type: 'case', ignore }),
      onLinkedImages: (ignore: boolean) =>
        dispatch({ type: 'linkedImages', ignore }),
      onHtmlSerialization: (ignore: boolean) =>
        dispatch({ type: 'htmlSerialization', ignore }),
      onKatexErrors: (ignore: boolean) =>
        dispatch({ type: 'katexErrors', ignore }),
      onLinkPolicy: (ignore: boolean) =>
        dispatch({ type: 'linkPolicy', ignore }),
      onBots: (exclude: boolean) => dispatch({ type: 'bots', exclude }),
      onPage: (page: number) => dispatch({ type: 'page', page, totalPages }),
      onOutput: (view: OutputView) => dispatch({ type: 'output', view })
    }
  }
}
