import React, { useState } from 'react'

import { type Mode, type ReportMetadata, modes } from '../report-schema.ts'
import { byMode, profileDefinitions } from '../shared/comparison.ts'
import DiffTable from './DiffTable.tsx'
import { type ReportRepository } from './data/repository.ts'
import { useReportQuery } from './hooks/useReportQuery.ts'

const labels = byMode(mode => profileDefinitions[mode].label)

export default function App({
  repository
}: {
  repository: ReportRepository | null
}) {
  const [mode, setMode] = useState<Mode>('render')
  const [outputView, setOutputView] = useState<'rendered' | 'raw'>('rendered')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const state = useReportQuery(repository, {
    mode,
    search,
    ignoreWhitespace,
    page
  })
  if (!repository)
    return (
      <main style={{ padding: 20 }}>
        <p id="status">
          読込に失敗しました。新しい Chrome / Edge
          で開いてください。（またはデータがありません）
        </p>
      </main>
    )
  const meta = repository.metadata
  const num = (value: number | string) => Number(value).toLocaleString('ja-JP')
  const ready = state.status === 'ready' ? state.result : undefined
  const rows = ready?.rows ?? []
  const totalHits = ready?.totalHits ?? meta.counts[mode]
  const totalPages = ready?.totalPages ?? 1
  const loading = state.status === 'loading' || state.status === 'idle'
  const statusText =
    state.status === 'failed'
      ? state.message
      : state.status === 'loading' && state.progress
        ? '検索 ' + num(state.progress.done) + ' / ' + num(state.progress.total)
        : num(totalHits) +
          ' 件' +
          (ready?.filtered ? ' / 全 ' + num(meta.counts[mode]) + ' 件' : '')
  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">MASTER → RUST</p>
          <h1>Markdown 差分一覧</h1>
          <p id="overview">
            {num(meta.messages)} 件を比較 · 差分のある結果のみ · 1ページ{' '}
            {num(meta.pageSize)}件 · 単独ファイルでオフライン閲覧
          </p>
        </div>
        <details className="speed">
          <summary>速度比較（参考）</summary>
          <div id="speed">
            <SpeedTable meta={meta} labels={labels} />
            <p>
              同一入力・{num(meta.run.warmups)}
              件のウォームアップ後に計測。before / after
              の実行順は交互。収集・ファイル出力・画面表示の時間は含みません。各モードを順に実行した際の参考値です。
            </p>
            {modes.map(key => (
              <p key={key}>
                {labels[key]} 初期化: before{' '}
                {meta.results[key].initialization.beforeMs.toFixed(2)} ms /
                after {meta.results[key].initialization.afterMs.toFixed(2)} ms。
              </p>
            ))}
            <p>
              S-UI は同一の固定参照・スタンプデータを使用。traQ は master の
              Parse と Rust PlainTextRenderer
              が返すプレーンテキストを比較。参考値です。
            </p>
          </div>
        </details>
      </header>
      <main>
        <nav className="toolbar">
          <div id="modes" className="modes">
            {modes.map(key => (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key)
                  setSearch('')
                  setSearchDraft('')
                  setPage(1)
                }}
              >
                {labels[key]} {num(meta.counts[key])}
              </button>
            ))}
            <select
              id="output-view"
              aria-label="表示形式"
              value={outputView}
              onChange={e =>
                setOutputView(e.target.value as 'rendered' | 'raw')
              }
            >
              <option value="rendered">レンダリング</option>
              <option value="raw">HTML / テキスト差分</option>
            </select>
          </div>
          <div className="controls">
            <form
              id="search-form"
              onSubmit={e => {
                e.preventDefault()
                setSearch(searchDraft)
                setPage(1)
              }}
            >
              <input
                name="search"
                id="search"
                type="search"
                placeholder="原文を検索"
                aria-label="原文を検索"
                value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)}
              />
              <button type="submit">検索</button>
            </form>
            <span id="status" aria-live="polite">
              {statusText} {loading ? '...' : ''}
            </span>
            <button
              id="previous"
              aria-label="前のページ"
              disabled={page <= 1}
              onClick={() => {
                setPage(p => p - 1)
                window.scrollTo({ top: 0 })
              }}
            >
              ← 前
            </button>
            <label>
              <input
                id="page"
                type="number"
                min="1"
                max={totalPages}
                value={ready?.page ?? page}
                onChange={e => setPage(Number(e.target.value) || 1)}
              />
              {' / '}
              <span id="pages">{num(totalPages)}</span>
            </label>
            <button
              id="next"
              aria-label="次のページ"
              disabled={page >= totalPages}
              onClick={() => {
                setPage(p => p + 1)
                window.scrollTo({ top: 0 })
              }}
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
              checked={ignoreWhitespace}
              onChange={e => {
                setIgnoreWhitespace(e.target.checked)
                setPage(1)
              }}
            />
            ホワイトスペースのみを除外
          </label>
        </div>

        {rows.length > 0 ? (
          <DiffTable rows={rows} outputView={outputView} mode={mode} />
        ) : (
          <p id="empty" hidden={loading || totalHits !== 0}>
            該当する差分はありません。
          </p>
        )}

        <footer id="footer">
          生成 {new Date(meta.generated).toLocaleString('ja-JP')}
          {modes.map(key => (
            <span key={key}>
              {' · '}
              {labels[key]} before{' '}
              {meta.run.provenance.before[key].revision.slice(0, 10)}
            </span>
          ))}
          {' · after: '}
          {meta.run.provenance.after.label}{' '}
          {meta.run.provenance.after.revision.slice(0, 10)}
          {
            ' · 外部画像はプレースホルダー表示。リンク・スクリプトは実行しません。'
          }
        </footer>
      </main>
    </>
  )
}

function SpeedTable({
  meta,
  labels
}: {
  meta: ReportMetadata
  labels: Record<Mode, string>
}) {
  const f = (n: number | string) =>
    Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return (
    <table>
      <thead>
        <tr>
          <th>表示</th>
          <th>平均 before / after (µs)</th>
          <th>中央値 before / after (µs)</th>
          <th>p95 before / after (µs)</th>
          <th>after / before</th>
        </tr>
      </thead>
      <tbody>
        {modes.map(key => {
          const data = meta.results[key]
          return (
            <tr key={key}>
              <td>{labels[key]}</td>
              <td>
                {f(data.before.meanUs)} / {f(data.after.meanUs)}
              </td>
              <td>
                {f(data.before.p50Us)} / {f(data.after.p50Us)}
              </td>
              <td>
                {f(data.before.p95Us)} / {f(data.after.p95Us)}
              </td>
              <td>{f(data.after.meanUs / data.before.meanUs)} 倍</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
