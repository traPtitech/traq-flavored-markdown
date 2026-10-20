import React, { useEffect, useRef } from 'react'

import type { DifferenceRow, Mode, OutputKind } from '../report-schema.ts'
import { outputDiff } from './data/diff.ts'
import { renderHTML } from './preview/html.ts'

type DiffTableProps = {
  rows: DifferenceRow[]
  outputView: 'rendered' | 'raw'
  mode: Mode
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
          <th>before · master</th>
          <th>after · Rust 移行版</th>
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
                <RenderCell text={row.before} kind={row.beforeType} />
                <RenderCell text={row.after} kind={row.afterType} />
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

function RenderCell({ text, kind }: { text: string; kind: OutputKind }) {
  const ref = useRef<HTMLDivElement | HTMLPreElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (kind !== 'html') {
      ref.current.textContent = text
    } else {
      ref.current.replaceChildren(renderHTML(text))
    }
  }, [text, kind])

  if (kind !== 'html') {
    return (
      <td>
        <pre
          className="cell-content plain-text"
          ref={ref as React.RefObject<HTMLPreElement>}
        />
      </td>
    )
  }
  return (
    <td>
      <div
        className="cell-content markdown-body"
        ref={ref as React.RefObject<HTMLDivElement>}
      />
    </td>
  )
}

function RawDiffCells({ row }: { row: DifferenceRow }) {
  const { parts, coarse } = outputDiff(row.before, row.after)

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
