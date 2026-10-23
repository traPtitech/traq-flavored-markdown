import { type ProfileId, profileIds } from '../../protocol/report.ts'
import type { Query } from '../data/query.ts'
import { profileLabels } from '../profiles.ts'
import type { OutputView } from '../state.ts'

const number = (value: number) => value.toLocaleString('ja-JP')

export function ComparisonControls({
  counts,
  query,
  searchDraft,
  outputView,
  status,
  loading,
  failed,
  totalPages,
  onProfile,
  onSearchDraft,
  onSearch,
  onWhitespace,
  onPage,
  onOutput
}: {
  counts: Record<ProfileId, number>
  query: Query
  searchDraft: string
  outputView: OutputView
  status: string
  loading: boolean
  failed: boolean
  totalPages: number
  onProfile: (profile: ProfileId) => void
  onSearchDraft: (text: string) => void
  onSearch: () => void
  onWhitespace: (ignore: boolean) => void
  onPage: (page: number) => void
  onOutput: (view: OutputView) => void
}) {
  const movePage = (page: number) => {
    onPage(page)
    window.scrollTo({ top: 0 })
  }
  return (
    <>
      <nav className="toolbar">
        <div id="profiles" className="profiles" aria-label="比較対象">
          {profileIds.map(profile => (
            <button
              key={profile}
              aria-pressed={query.profile === profile}
              onClick={() => onProfile(profile)}
            >
              {profileLabels[profile]} {number(counts[profile])}
            </button>
          ))}
          <select
            id="output-view"
            aria-label="表示形式"
            value={outputView}
            onChange={event =>
              onOutput(event.target.value === 'raw' ? 'raw' : 'rendered')
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
              onSearch()
            }}
          >
            <input
              name="search"
              id="search"
              type="search"
              placeholder="原文を検索"
              aria-label="原文を検索"
              value={searchDraft}
              onChange={event => onSearchDraft(event.target.value)}
            />
            <button type="submit">検索</button>
          </form>
          <span
            id="status"
            role={failed ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status}
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
              aria-label="ページ"
              type="number"
              min="1"
              max={totalPages}
              disabled={loading}
              value={query.page}
              onChange={event => onPage(Number(event.target.value))}
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
            onChange={event => onWhitespace(event.target.checked)}
          />
          ホワイトスペースのみを除外
        </label>
      </div>
    </>
  )
}
