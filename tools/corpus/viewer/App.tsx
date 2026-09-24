import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  type DifferenceRow,
  type Mode,
  type ReportMetadata,
  type ReportPayload,
  modes
} from '../report-schema.ts'
import DiffTable from './DiffTable.tsx'

const labels: Record<Mode, string> = {
  render: 'traQ_S-UI · 通常',
  inline: 'traQ_S-UI · インライン',
  plainText: 'traQ · プレーンテキスト'
}

const getInitialData = <T,>(id: string): T | null => {
  try {
    const el = document.getElementById(id)
    if (el?.textContent) {
      const data = JSON.parse(el.textContent)
      el.remove()
      return data
    }
  } catch (_e) {}
  return null
}

export default function App() {
  const [meta] = useState<ReportMetadata | null>(() =>
    getInitialData('metadata')
  )
  const [payload] = useState<ReportPayload | null>(() =>
    getInitialData('payload')
  )
  const loadingError = !meta || !payload

  const [mode, setMode] = useState<Mode>('render')
  const [outputView, setOutputView] = useState<'rendered' | 'raw'>('rendered')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)

  const filterKey = JSON.stringify([
    mode,
    search.trim().toLowerCase(),
    ignoreWhitespace
  ])
  const [filter, setFilter] = useState<{
    key: string
    hits: [number, number][] | null
  } | null>(null)
  const [filterProgress, setFilterProgress] = useState<{
    key: string
    done: number
    total: number
  } | null>(null)
  const [rowResult, setRowResult] = useState<{
    key: string
    rows: DifferenceRow[]
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const num = (n: number | string) => Number(n).toLocaleString('ja-JP')

  const chunkCache = useRef(new Map<string, Promise<DifferenceRow[]>>())
  const loadChunk = useCallback(
    async (m: Mode, index: number) => {
      const key = `${m}:${index}`
      const cached = chunkCache.current.get(key)
      if (cached) return cached
      const encoded = payload?.[m][index]
      if (!encoded) throw new Error(`Missing ${m} chunk ${index}`)
      const task = (async () => {
        const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
        const text = await new Response(
          new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream('gzip'))
        ).text()
        return JSON.parse(text) as DifferenceRow[]
      })()
      chunkCache.current.set(key, task)
      if (chunkCache.current.size > 10) {
        chunkCache.current.delete(chunkCache.current.keys().next().value!)
      }
      try {
        return await task
      } catch (error) {
        chunkCache.current.delete(key)
        throw error
      }
    },
    [payload]
  )

  useEffect(() => {
    if (!meta || !payload) return
    let active = true

    const applyFilters = async () => {
      setLoadError(null)
      setPage(1)
      const query = search.trim().toLowerCase()
      if (!query && !ignoreWhitespace) {
        setFilter({ key: filterKey, hits: null })
        return
      }

      try {
        const flags = meta.filters[mode]
        const found: [number, number][] = []
        for (let chunk = 0; chunk < payload[mode].length; chunk++) {
          const chunkRows = query ? await loadChunk(mode, chunk) : null
          if (!active) return

          const length = Math.min(
            meta.pageSize,
            meta.counts[mode] - chunk * meta.pageSize
          )
          for (let index = 0; index < length; index++) {
            if (
              ignoreWhitespace &&
              flags[chunk * meta.pageSize + index] === '1'
            )
              continue
            if (
              !query ||
              chunkRows![index].source.toLowerCase().includes(query)
            ) {
              found.push([chunk, index])
            }
          }
          if (query && active) {
            setFilterProgress({
              key: filterKey,
              done: chunk + 1,
              total: payload[mode].length
            })
          }
        }
        if (active) {
          setFilter({
            key: filterKey,
            hits: found.length === meta.counts[mode] ? null : found
          })
        }
      } catch (error) {
        if (active) setLoadError(String(error))
      }
    }

    void applyFilters()
    return () => {
      active = false
    }
  }, [mode, search, ignoreWhitespace, meta, payload, filterKey, loadChunk])

  const filterReady = filter?.key === filterKey
  const hits = filterReady ? filter.hits : null
  const totalHits = filterReady
    ? hits === null
      ? (meta?.counts[mode] ?? 0)
      : hits.length
    : (meta?.counts[mode] ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalHits / (meta?.pageSize ?? 1)))
  const rowKey = `${filterKey}:${page}`

  useEffect(() => {
    if (!meta || !payload || !filterReady) return
    let active = true

    const loadRows = async () => {
      const validPage = Math.min(Math.max(1, page), totalPages)
      if (page !== validPage) {
        setPage(validPage)
        return
      }

      try {
        let newRows: DifferenceRow[] = []
        if (totalHits > 0) {
          if (hits === null) {
            newRows = await loadChunk(mode, validPage - 1)
          } else {
            for (const [chunk, index] of hits.slice(
              (validPage - 1) * meta.pageSize,
              validPage * meta.pageSize
            )) {
              const chunkRows = await loadChunk(mode, chunk)
              newRows.push(chunkRows[index])
            }
          }
        }
        if (active) setRowResult({ key: rowKey, rows: newRows })
      } catch (error) {
        if (active) setLoadError(String(error))
      }
    }

    void loadRows()
    return () => {
      active = false
    }
  }, [
    mode,
    page,
    hits,
    meta,
    payload,
    filterReady,
    rowKey,
    totalPages,
    totalHits,
    loadChunk
  ])

  if (loadingError) {
    return (
      <main style={{ padding: 20 }}>
        <p id="status">
          読込に失敗しました。新しい Chrome / Edge
          で開いてください。（またはデータがありません）
        </p>
      </main>
    )
  }

  if (!meta) return <div style={{ padding: 20 }}>Loading...</div>

  const rows = rowResult?.key === rowKey && filterReady ? rowResult.rows : []
  const loading = !loadError && (!filterReady || rowResult?.key !== rowKey)
  const statusText =
    loadError ??
    (!filterReady && filterProgress?.key === filterKey
      ? `検索 ${num(filterProgress.done)} / ${num(filterProgress.total)}`
      : `${num(totalHits)} 件${hits === null ? '' : ` / 全 ${num(meta.counts[mode])} 件`}`)

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
              同一入力・200件のウォームアップ後に計測。before / after
              の実行順は交互。収集・ファイル出力・画面表示の時間は含みません。各モードを順に実行した際の参考値です。
            </p>
            <p>
              初期化: S-UI before {meta.sui.beforeInitializationMs.toFixed(2)}{' '}
              ms / after {meta.sui.afterInitializationMs.toFixed(2)} ms、traQ
              Rust {meta.traq.afterInitializationMs.toFixed(2)}{' '}
              ms。モジュール読込は除きます。
            </p>
            <p>
              S-UI は同一の固定 Store を使用。traQ は master の Parse と Rust
              PlainTextRenderer が返すプレーンテキストを比較。参考値です。
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
                value={page}
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
              onChange={e => setIgnoreWhitespace(e.target.checked)}
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
          {' · master: S-UI '}
          {meta.revisions.suiMaster.slice(0, 10)}
          {' / traQ '}
          {meta.revisions.traqMaster.slice(0, 10)}
          {' · after: renderer '}
          {meta.revisions.renderer.slice(0, 10)}
          {' / SDK '}
          {meta.revisions.processor.slice(0, 10)}
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
          const data = key === 'plainText' ? meta.traq : meta.sui.modes[key]
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
