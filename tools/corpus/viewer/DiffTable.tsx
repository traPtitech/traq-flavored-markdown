import { diffStringsRaw } from 'jest-diff'
import React, { useEffect, useRef } from 'react'

type Row = {
  index: number
  source: string
  before: string
  after: string
  error?: boolean
}

type DiffTableProps = {
  rows: Row[]
  outputView: 'rendered' | 'raw'
  mode: string
}

export default function DiffTable({ rows, outputView, mode }: DiffTableProps) {
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
            <SourceCell row={row} mode={mode} />
            {outputView === 'raw' ? (
              <RawDiffCells row={row} />
            ) : (
              <>
                <RenderCell text={row.before} mode={mode} />
                <RenderCell text={row.after} mode={mode} />
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SourceCell({ row }: { row: Row; mode: string }) {
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

function RenderCell({ text, mode }: { text: string; mode: string }) {
  const ref = useRef<HTMLDivElement | HTMLPreElement>(null)

  useEffect(() => {
    if (!ref.current) return
    if (mode === 'notification' || text.startsWith('解析エラー:')) {
      ref.current.textContent = text
    } else {
      ref.current.replaceChildren(renderHTML(text))
    }
  }, [text, mode])

  if (mode === 'notification' || text.startsWith('解析エラー:')) {
    return (
      <td>
        <pre
          className="cell-content notification"
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

function RawDiffCells({ row }: { row: Row }) {
  let parts: [number, string][]
  let coarse = false

  if (row.before.length + row.after.length <= 12000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts = diffStringsRaw(row.before, row.after, true) as any
  } else {
    coarse = true
    let start = 0
    let end = 0
    while (
      start < Math.min(row.before.length, row.after.length) &&
      row.before[start] === row.after[start]
    ) {
      start++
    }
    while (
      end < Math.min(row.before.length, row.after.length) - start &&
      row.before[row.before.length - end - 1] ===
        row.after[row.after.length - end - 1]
    ) {
      end++
    }
    parts = [
      [0, row.before.slice(0, start)],
      [-1, row.before.slice(start, row.before.length - end)],
      [1, row.after.slice(start, row.after.length - end)],
      [0, row.before.slice(row.before.length - end)]
    ]
  }

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

const allowed = new Set(
  'p div span pre code br hr strong b em i del s ins mark sub sup a ul ol li blockquote h1 h2 h3 h4 h5 h6 table thead tbody tr td th cite svg path line'.split(
    ' '
  )
)
const styleNames = [
  'height',
  'width',
  'min-width',
  'vertical-align',
  'margin-right',
  'margin-left',
  'top',
  'background-color',
  'text-align'
]

function renderHTML(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const copy = (node: any): Node => {
    if (node.nodeType === 3) return document.createTextNode(node.data!)
    if (node.nodeType !== 1) return document.createTextNode('')

    if (node.localName === 'img') {
      const span = document.createElement('span')
      span.className = 'r-image'
      span.textContent =
        '[画像: ' + (node.getAttribute?.('alt') || '外部画像') + ']'
      return span
    }

    if (!allowed.has(node.localName!)) return document.createTextNode('')

    const name = node.localName === 'a' ? 'span' : node.localName!
    const value = ['svg', 'path', 'line'].includes(name)
      ? document.createElementNS('http://www.w3.org/2000/svg', name)
      : document.createElement(name)

    for (const attr of [
      'class',
      'title',
      'colspan',
      'rowspan',
      'start',
      'aria-hidden',
      'viewBox',
      'd',
      'width',
      'height',
      'x1',
      'x2',
      'y1',
      'y2'
    ]) {
      if (node.hasAttribute?.(attr)) {
        value.setAttribute(attr, node.getAttribute!(attr)!)
      }
    }

    for (const key of styleNames) {
      const text = node.style?.getPropertyValue(key)
      if (text && !/url|var\(|attr\(/i.test(text)) {
        ;(value as HTMLElement).style?.setProperty(key, text)
      }
    }

    if (node.localName === 'a') {
      ;(value as HTMLElement).classList.add('r-link')
      ;(value as HTMLElement).title = node.getAttribute?.('href') || 'リンク'
    }

    if (node.childNodes) {
      for (const child of Array.from(node.childNodes)) {
        value.appendChild(copy(child))
      }
    }
    return value
  }

  const result = document.createDocumentFragment()
  for (const child of Array.from(template.content.childNodes)) {
    result.appendChild(copy(child))
  }
  return result
}
