import React, { useEffect, useRef, useState } from 'react'

import DiffTable from './DiffTable.tsx'

type Meta = {
  messages: number
  counts: Record<string, number>
  filters: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sui: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  traq: any
  revisions: Record<string, string>
  generated: string
}

type Payload = Record<string, string[]> // mode -> base64 gzipped strings
type Row = {
  index: number
  source: string
  before: string
  after: string
  error?: boolean
}

const labels = {
  render: 'traQ_S-UI · 通常',
  inline: 'traQ_S-UI · インライン',
  notification: 'traQ · 通知'
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
  const [meta] = useState<Meta | null>(() => getInitialData('metadata'))
  const [payload] = useState<Payload | null>(() => getInitialData('payload'))
  const loadingError = !meta || !payload

  const [mode, setMode] = useState<keyof typeof labels>('render')
  const [outputView, setOutputView] = useState<'rendered' | 'raw'>('rendered')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)

  const [hits, setHits] = useState<[number, number][] | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')

  const num = (n: number | string) => Number(n).toLocaleString('ja-JP')

  // Cache for loaded chunks
  const chunkCache = useRef(new Map<string, Row[]>())

  const loadChunk = async (m: string, index: number) => {
    const key = `${m}:${index}`
    if (chunkCache.current.has(key)) return chunkCache.current.get(key)!
    if (!payload) return []

    const bytes = Uint8Array.from(atob(payload[m][index]), c => c.charCodeAt(0))
    const text = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text()
    const parsed = JSON.parse(text) as Row[]
    chunkCache.current.set(key, parsed)
    if (chunkCache.current.size > 10) {
      chunkCache.current.delete(chunkCache.current.keys().next().value!)
    }
    return parsed
  }

  // Filter effect
  useEffect(() => {
    if (!meta || !payload) return
    let active = true

    const applyFilters = async () => {
      const q = search.trim().toLowerCase()
      const bit = ignoreWhitespace ? 1 : 0
      if (!q && !bit) {
        if (active) {
          setHits(null)
          setPage(1)
        }
        return
      }

      setLoading(true)
      const flags = meta.filters[mode]
      const found: [number, number][] = []

      for (let chunk = 0; chunk < payload[mode].length; chunk++) {
        const chunkRows = q ? await loadChunk(mode, chunk) : null
        if (!active) return

        const length = Math.min(50, meta.counts[mode] - chunk * 50)
        for (let j = 0; j < length; j++) {
          if (bit && (flags.charCodeAt(chunk * 50 + j) - 48) & bit) continue
          if (!q || chunkRows![j].source.toLowerCase().includes(q)) {
            found.push([chunk, j])
          }
        }
        if (q) {
          setStatusText(`検索 ${num(chunk + 1)} / ${num(payload[mode].length)}`)
        }
      }

      if (active) {
        setHits(found.length === meta.counts[mode] ? null : found)
        setPage(1)
        setLoading(false)
      }
    }

    applyFilters()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, search, ignoreWhitespace, meta, payload])

  // Pagination & rows effect
  useEffect(() => {
    if (!meta || !payload) return
    let active = true

    const loadRows = async () => {
      setLoading(true)
      const total = hits === null ? meta.counts[mode] : hits.length
      const pages = Math.max(1, Math.ceil(total / 50))
      const validPage = Math.min(Math.max(1, page), pages)
      if (page !== validPage) {
        setPage(validPage)
        return
      }

      let newRows: Row[] = []
      if (total > 0) {
        if (hits === null) {
          newRows = await loadChunk(mode, validPage - 1)
        } else {
          for (const [chunk, index] of hits.slice(
            (validPage - 1) * 50,
            validPage * 50
          )) {
            const chunkRows = await loadChunk(mode, chunk)
            newRows.push(chunkRows[index])
          }
        }
      }

      if (active) {
        setRows(newRows)
        setStatusText(
          `${num(total)} 件${hits === null ? '' : ` / 全 ${num(meta.counts[mode])} 件`}`
        )
        setLoading(false)
      }
    }

    loadRows()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, hits, meta, payload])

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

  const totalHits = hits === null ? meta.counts[mode] : hits.length
  const totalPages = Math.max(1, Math.ceil(totalHits / 50))

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">MASTER → RUST</p>
          <h1>Markdown 差分一覧</h1>
          <p id="overview">
            {num(meta.messages)} 件を比較 · 差分のある結果のみ · 1ページ 50件 ·
            単独ファイルでオフライン閲覧
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
              PlainTextRenderer が返す通知テキストを比較。参考値です。
            </p>
          </div>
        </details>
      </header>
      <main>
        <nav className="toolbar">
          <div id="modes" className="modes">
            {(Object.keys(labels) as (keyof typeof labels)[]).map(key => (
              <button
                key={key}
                aria-pressed={mode === key}
                onClick={() => {
                  setMode(key)
                  setSearch('')
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
                const form = e.target as HTMLFormElement
                const input = form.elements.namedItem(
                  'search'
                ) as HTMLInputElement
                setSearch(input.value)
              }}
            >
              <input
                name="search"
                id="search"
                type="search"
                placeholder="原文を検索"
                aria-label="原文を検索"
                defaultValue={search}
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
          <label title="HTML・通知の文字列から半角スペース、タブ、改行、フォームフィードを除いて一致する結果を非表示にします。コードや属性値内の空白も対象です。">
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
  meta: Meta
  labels: Record<string, string>
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
        {(Object.keys(labels) as (keyof typeof labels)[]).map(key => {
          const data = key === 'notification' ? meta.traq : meta.sui.modes[key]
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
