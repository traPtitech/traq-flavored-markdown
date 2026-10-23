import { type ReportMetadata, profileIds } from '../../protocol/report.ts'
import type { ViewerController } from '../hooks/useViewerController.ts'
import { profileLabels } from '../profiles.ts'
import type { OutputView } from '../state.ts'

const number = (value: number) => value.toLocaleString('ja-JP')

export function ComparisonControls({
  metadata,
  controller
}: {
  metadata: ReportMetadata
  controller: ViewerController
}) {
  const {
    state,
    dispatch,
    response,
    result,
    totalHits,
    totalPages,
    loading,
    selectPage
  } = controller
  const { query } = state
  const status =
    response.status === 'failed'
      ? response.message
      : response.status === 'loading' && response.progress
        ? `検索 ${number(response.progress.done)} / ${number(response.progress.total)}`
        : number(totalHits) +
          ' 件' +
          (result?.filtered
            ? ` / 全 ${number(metadata.counts[query.mode])} 件`
            : '')
  const movePage = (page: number) => {
    selectPage(page)
    window.scrollTo({ top: 0 })
  }
  return (
    <>
      <nav className="toolbar">
        <div id="profileIds" className="profileIds">
          {profileIds.map(mode => (
            <button
              key={mode}
              aria-pressed={query.mode === mode}
              onClick={() => dispatch({ type: 'mode', mode })}
            >
              {profileLabels[mode]} {number(metadata.counts[mode])}
            </button>
          ))}
          <select
            id="output-view"
            aria-label="表示形式"
            value={state.outputView}
            onChange={event =>
              dispatch({
                type: 'output',
                view: event.target.value as OutputView
              })
            }
          >
            <option value="rendered">レンダリング</option>
            <option value="raw">HTML / テキスト差分</option>
          </select>
        </div>
        <div className="controls">
          <form
            id="search-form"
            onSubmit={event => {
              event.preventDefault()
              dispatch({ type: 'search' })
            }}
          >
            <input
              name="search"
              id="search"
              type="search"
              placeholder="原文を検索"
              aria-label="原文を検索"
              value={state.searchDraft}
              onChange={event =>
                dispatch({ type: 'draft', text: event.target.value })
              }
            />
            <button type="submit">検索</button>
          </form>
          <span id="status" aria-live="polite">
            {status} {loading ? '...' : ''}
          </span>
          <button
            id="previous"
            aria-label="前のページ"
            disabled={loading || query.page <= 1}
            onClick={() => movePage(query.page - 1)}
          >
            ← 前
          </button>
          <label>
            <input
              id="page"
              type="number"
              min="1"
              max={totalPages}
              disabled={loading}
              value={query.page}
              onChange={event => selectPage(Number(event.target.value))}
            />
            {' / '}
            <span id="pages">{number(totalPages)}</span>
          </label>
          <button
            id="next"
            aria-label="次のページ"
            disabled={loading || query.page >= totalPages}
            onClick={() => movePage(query.page + 1)}
          >
            次 →
          </button>
        </div>
      </nav>
      <div className="filters">
        <label title="HTML・プレーンテキストの文字列から半角スペース、タブ、改行、フォームフィードを除いて一致する結果を非表示にします。コードや属性値内の空白も対象です。">
          <input
            type="checkbox"
            id="ignore-whitespace"
            checked={query.ignoreWhitespace}
            onChange={event =>
              dispatch({ type: 'whitespace', ignore: event.target.checked })
            }
          />
          ホワイトスペースのみを除外
        </label>
      </div>
    </>
  )
}
