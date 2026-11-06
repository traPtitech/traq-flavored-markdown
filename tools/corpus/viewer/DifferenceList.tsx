import { useState } from 'react'

import {
  type Classification,
  classificationRules,
  needsReview
} from '../protocol/classification.ts'
import type { DifferenceRow } from '../protocol/report.ts'
import DiffTable from './DiffTable.tsx'
import type { OutputView } from './state.ts'

export function DifferenceList({
  rows,
  classifications,
  outputView
}: {
  rows: DifferenceRow[]
  classifications: Classification[]
  outputView: OutputView
}) {
  return (
    <div id="rows" className="difference-list">
      {rows.map((row, index) => (
        <DifferenceEntry
          key={`${row.profile}:${row.index}`}
          row={row}
          classification={classifications[index]}
          outputView={outputView}
          initialOpen={index === 0}
        />
      ))}
    </div>
  )
}

function DifferenceEntry({
  row,
  classification,
  outputView,
  initialOpen
}: {
  row: DifferenceRow
  classification: Classification
  outputView: OutputView
  initialOpen: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  const rules = classificationRules.filter(rule =>
    classification.tags.includes(rule.id)
  )
  const review = needsReview(classification)
  return (
    <details
      className="difference-entry"
      id={`case-${row.profile}-${row.index}`}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="difference-title">
          #{(row.index + 1).toLocaleString('ja-JP')} ·{' '}
          {row.source.slice(0, 160).replaceAll('\n', ' ↵ ')}
        </span>
        <span
          className={`classification-badge ${review ? 'review-badge' : ''}`}
        >
          {review ? '要確認' : '確認済み'}
        </span>
        <span className="classification-tags">
          {rules.map(rule => (
            <span
              key={rule.id}
              className={`classification-badge ${rule.decision === 'review' ? 'review-badge' : ''}`}
            >
              {rule.title} ·{' '}
              {rule.decision === 'accepted' ? '採用済み' : '未判断'}
            </span>
          ))}
          {!classification.complete && (
            <span className="classification-badge review-badge">
              未説明の差分あり
            </span>
          )}
        </span>
      </summary>
      {open && (
        <div className="difference-detail">
          <DiffTable rows={[row]} outputView={outputView} />
          <div className="classification-evidence" aria-label="分類の根拠">
            {rules.map(rule => (
              <div key={rule.id}>
                <strong>{rule.title}</strong>
                <p>
                  {rule.description} {rule.reason}
                </p>
              </div>
            ))}
            {!classification.complete && (
              <div>
                <strong>未説明の差分あり</strong>
                <p>
                  検出した変換を適用しても出力全体は一致しません。この行は要確認に残ります。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </details>
  )
}
