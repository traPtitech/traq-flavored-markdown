import React, { useEffect, useRef } from 'react'

import type { Outcome } from '../protocol/comparison.ts'
import type { DifferenceRow } from '../protocol/report.ts'
import { outputDiff } from './data/diff.ts'
import { renderHTML } from './preview/html.ts'
import type { OutputView } from './state.ts'

type DiffTableProps = {
  rows: DifferenceRow[]
  outputView: OutputView
}

export default function DiffTable({ rows, outputView }: DiffTableProps) {
  return (
    <table className="comparison">
      <colgroup>
        <col className="source-col" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>原文</th>
          <th>before</th>
          <th>after</th>
        </tr>
      </thead>
      <tbody id="rows">
        {rows.map(row => (
          <tr key={row.index}>
            <SourceCell row={row} />
            {outputView === 'raw' ? (
              <RawDiffCells row={row} />
            ) : (
              <>
                <RenderCell outcome={row.before} />
                <RenderCell outcome={row.after} />
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SourceCell({ row }: { row: DifferenceRow }) {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <td className={expanded ? 'expanded' : ''}>
      <div className="case-label">
        #{Number(row.index + 1).toLocaleString('ja-JP')}
        <button className="expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? '折りたたむ' : '展開'}
        </button>
      </div>
      <pre className="cell-content source">{row.source}</pre>
    </td>
  )
}

function RenderCell({ outcome }: { outcome: Outcome }) {
  return (
    <td>
      {outcome.kind === 'html' ? (
        <HtmlPreview html={outcome.value} />
      ) : (
        <pre
          className={`cell-content plain-text${outcome.kind === 'error' ? ' output-error' : ''}`}
        >
          {outcome.kind === 'error' && <strong>実行エラー: </strong>}
          {outcome.value}
        </pre>
      )}
    </td>
  )
}

function HtmlPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.replaceChildren(renderHTML(html))
  }, [html])
  return <div className="cell-content markdown-body" ref={ref} />
}

function RawDiffCells({ row }: { row: DifferenceRow }) {
  const { parts, coarse } = outputDiff(row.before.value, row.after.value)

  const title = coarse
    ? '長い出力のため、共通の先頭・末尾を除いた変更範囲をまとめて強調しています。文字列は省略していません。'
    : undefined

  const renderSide = (isAfter: boolean) => {
    return (
      <pre className="cell-content raw-html" title={title}>
        {parts.map((part, i) => {
          const op = part[0]
          const value = part[1]
          if (!value) return null
          if (op === (isAfter ? -1 : 1)) return null

          if (op === 0) return <span key={i}>{value}</span>
          return (
            <mark key={i} className={op === -1 ? 'diff-removed' : 'diff-added'}>
              {value}
            </mark>
          )
        })}
      </pre>
    )
  }

  return (
    <>
      <td>{renderSide(false)}</td>
      <td>{renderSide(true)}</td>
    </>
  )
}
