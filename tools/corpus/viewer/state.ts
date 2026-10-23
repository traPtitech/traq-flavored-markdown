import type { ProfileId } from '../protocol/report.ts'
import { type Query, normalizePage } from './data/query.ts'

export type OutputView = 'rendered' | 'raw'
export type ViewerState = {
  query: Query
  searchDraft: string
  outputView: OutputView
}
export const initialViewerState: ViewerState = {
  query: { mode: 'render', search: '', ignoreWhitespace: false, page: 1 },
  searchDraft: '',
  outputView: 'rendered'
}
export type ViewerAction =
  | { type: 'mode'; mode: ProfileId }
  | { type: 'draft'; text: string }
  | { type: 'search' }
  | { type: 'whitespace'; ignore: boolean }
  | { type: 'page'; page: number; totalPages: number }
  | { type: 'output'; view: OutputView }

/** Every query transition keeps pagination valid before a request is started. */
export function viewerReducer(
  state: ViewerState,
  action: ViewerAction
): ViewerState {
  switch (action.type) {
    case 'mode':
      return {
        ...state,
        searchDraft: '',
        query: { ...state.query, mode: action.mode, search: '', page: 1 }
      }
    case 'draft':
      return { ...state, searchDraft: action.text }
    case 'search':
      return {
        ...state,
        query: { ...state.query, search: state.searchDraft, page: 1 }
      }
    case 'whitespace':
      return {
        ...state,
        query: { ...state.query, ignoreWhitespace: action.ignore, page: 1 }
      }
    case 'page':
      return {
        ...state,
        query: {
          ...state.query,
          page: normalizePage(action.page, action.totalPages)
        }
      }
    case 'output':
      return { ...state, outputView: action.view }
  }
}
