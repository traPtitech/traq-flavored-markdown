import { type ProfileId, profileIds } from '../../protocol/report.ts'
import type { Query } from '../data/query.ts'
import { profileLabels } from '../profiles.ts'
import type { OutputView } from '../state.ts'

const number = (value: number) => value.toLocaleString('ja-JP')

export function ComparisonControls({
  counts,
  authors,
  hasAuthorData,
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
  onCase,
  onLinkedImages,
  onHtmlSerialization,
  onKatexErrors,
  onBots,
  onPage,
  onOutput
}: {
  counts: Record<ProfileId, number>
  authors: string
  hasAuthorData: boolean
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
  onCase: (ignore: boolean) => void
  onLinkedImages: (ignore: boolean) => void
  onHtmlSerialization: (ignore: boolean) => void
  onKatexErrors: (ignore: boolean) => void
  onBots: (exclude: boolean) => void
  onPage: (page: number) => void
  onOutput: (view: OutputView) => void
}) {
  const unknownAuthors = authors.split('u').length - 1
  const botAuthors = authors.split('b').length - 1
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
        {hasAuthorData && (
          <>
            <label title="収集時のtraQアカウント情報でBOTと確認できた投稿を非表示にします。投稿者不明のデータは残します。">
              <input
                type="checkbox"
                id="exclude-bots"
                checked={query.excludeBots}
                onChange={event => onBots(event.target.checked)}
              />
              BOTの投稿を除外
            </label>
            <span id="author-status">
              {`BOT ${number(botAuthors)} 件${unknownAuthors ? ` / 投稿者不明 ${number(unknownAuthors)} 件（除外対象外）` : ''}`}
            </span>
          </>
        )}
        <label title="HTML・プレーンテキストの文字列から半角スペース、タブ、改行、フォームフィードを除いて一致する結果を非表示にします。コードや属性値内の空白も対象です。">
          <input
            type="checkbox"
            id="ignore-whitespace"
            checked={query.ignoreWhitespace}
            onChange={event => onWhitespace(event.target.checked)}
          />
          ホワイトスペースのみを除外
        </label>
        <label title="HTML・プレーンテキストの文字列を小文字にして一致する結果を非表示にします。タグ名や属性値も対象です。ホワイトスペースの除外と併用すると、両方の違いを無視します。">
          <input
            type="checkbox"
            id="ignore-case"
            checked={query.ignoreCase}
            onChange={event => onCase(event.target.checked)}
          />
          大文字・小文字の違いのみを除外
        </label>
        <label title="画像を表示しない場合のリンク付き画像について、外側のリンク先を保つ新実装との表示差分だけを非表示にします。他の差分が混在する結果は残します。ホワイトスペース・大文字小文字の除外とも併用できます。">
          <input
            type="checkbox"
            id="ignore-linked-images"
            checked={query.ignoreLinkedImages}
            onChange={event => onLinkedImages(event.target.checked)}
          />
          リンク付き画像の表示差分を除外
        </label>
        <label title="HTMLの属性順序、引用符、同じ文字を表す文字参照などの表記差だけを非表示にします。本文の空白・属性値・要素構造の変更や解析エラーがあるHTMLは、この条件では除外しません。他の除外条件とも併用できます。">
          <input
            type="checkbox"
            id="ignore-html-serialization"
            checked={query.ignoreHtmlSerialization}
            onChange={event => onHtmlSerialization(event.target.checked)}
          />
          HTMLの表記差分のみを除外
        </label>
        <label title="両側に同じ数のKaTeXエラー表示があり、その本文・診断メッセージだけが異なる結果を非表示にします。片側だけの数式エラーや、本文・表示構造の差分は残します。他の除外条件とも併用できます。">
          <input
            type="checkbox"
            id="ignore-katex-errors"
            checked={query.ignoreKatexErrors}
            onChange={event => onKatexErrors(event.target.checked)}
          />
          KaTeXエラー部分のみの差分を除外
        </label>
      </div>
    </>
  )
}
