import type { ProfileId } from '../protocol/report.ts'
import { type Query, normalizePage } from './data/query.ts'

export type OutputView = 'rendered' | 'raw'
export type ViewerState = {
  query: Query
  searchDraft: string
  outputView: OutputView
}
export const initialViewerState: ViewerState = {
  query: {
    profile: 'render',
    search: '',
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    excludeBots: false,
    page: 1
  },
  searchDraft: '',
  outputView: 'rendered'
}
export type ViewerAction =
  | { type: 'profile'; profile: ProfileId }
  | { type: 'draft'; text: string }
  | { type: 'search' }
  | { type: 'whitespace'; ignore: boolean }
  | { type: 'case'; ignore: boolean }
  | { type: 'linkedImages'; ignore: boolean }
  | { type: 'htmlSerialization'; ignore: boolean }
  | { type: 'katexErrors'; ignore: boolean }
  | { type: 'bots'; exclude: boolean }
  | { type: 'page'; page: number; totalPages: number }
  | { type: 'output'; view: OutputView }

/** Every query transition keeps pagination valid before a request is started. */
export function viewerReducer(
  state: ViewerState,
  action: ViewerAction
): ViewerState {
  switch (action.type) {
    case 'profile':
      return {
        ...state,
        searchDraft: '',
        query: { ...state.query, profile: action.profile, search: '', page: 1 }
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
    case 'case':
      return {
        ...state,
        query: { ...state.query, ignoreCase: action.ignore, page: 1 }
      }
    case 'linkedImages':
      return {
        ...state,
        query: { ...state.query, ignoreLinkedImages: action.ignore, page: 1 }
      }
    case 'htmlSerialization':
      return {
        ...state,
        query: {
          ...state.query,
          ignoreHtmlSerialization: action.ignore,
          page: 1
        }
      }
    case 'page':
      return {
        ...state,
        query: {
          ...state.query,
          page: normalizePage(action.page, action.totalPages)
        }
      }
    case 'bots':
      return {
        ...state,
        query: { ...state.query, excludeBots: action.exclude, page: 1 }
      }
    case 'katexErrors':
      return {
        ...state,
        query: { ...state.query, ignoreKatexErrors: action.ignore, page: 1 }
      }
    case 'output':
      return { ...state, outputView: action.view }
  }
}
