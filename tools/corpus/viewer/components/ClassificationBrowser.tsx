import {
  type ClassificationSelection,
  classificationGroups,
  classificationRules
} from '../../protocol/classification.ts'
import type { ClassificationCounts } from '../data/query.ts'

export function ClassificationTree({
  selection,
  counts,
  onSelect
}: {
  selection: ClassificationSelection
  counts: ClassificationCounts
  onSelect: (selection: ClassificationSelection) => void
}) {
  const item = (id: ClassificationSelection, title: string, child = false) => (
    <button
      key={id}
      type="button"
      className={child ? 'category-child' : undefined}
      data-category={id}
      aria-pressed={selection === id}
      onClick={() => onSelect(id)}
    >
      <span>{title}</span>
      <span className="category-count">
        {(counts[id]?.total ?? 0).toLocaleString('ja-JP')}
      </span>
    </button>
  )
  return (
    <nav className="classification-tree" aria-label="差分の分類">
      <p className="classification-caption">差分メッセージ</p>
      {item('all', 'すべて')}
      {item('residual', '未説明の差分あり')}
      {item('unclassified', '分類なし')}
      {Object.entries(classificationGroups).map(([id, title]) => (
        <div className="category-group" key={id}>
          {item(id as keyof typeof classificationGroups, title)}
          {classificationRules
            .filter(rule => rule.group === id)
            .map(rule => item(rule.id, rule.title, true))}
        </div>
      ))}
      <p className="classification-caption">
        件数は現在の検索・除外条件に合うメッセージ数。分類間の重複があります。
      </p>
    </nav>
  )
}

export function ClassificationSummary({
  selection,
  counts,
  onlyReview,
  onReview
}: {
  selection: ClassificationSelection
  counts: ClassificationCounts
  onlyReview: boolean
  onReview: (only: boolean) => void
}) {
  const rule = classificationRules.find(rule => rule.id === selection)
  const title =
    rule?.title ??
    classificationGroups[selection as keyof typeof classificationGroups] ??
    {
      all: 'すべての差分',
      residual: '未説明の差分あり',
      unclassified: '分類なし'
    }[selection as 'all']
  const count = counts[selection]
  return (
    <section className="classification-summary" aria-label="選択中の分類">
      {rule && (
        <p className="classification-caption">
          {classificationGroups[rule.group]} / 分類別の差分
        </p>
      )}
      <h2>{title}</h2>
      {rule && (
        <>
          <p>{rule.description}</p>
          <p>
            <span
              className={`classification-badge ${rule.decision === 'review' ? 'review-badge' : ''}`}
            >
              {rule.decision === 'accepted' ? '採用済み' : '未判断'}
            </span>{' '}
            {rule.reason}
          </p>
        </>
      )}
      {selection === 'residual' && (
        <p>
          検出済みの分類だけでは出力全体の差を説明できない行です。一部分に分類が付いた行も含みます。
        </p>
      )}
      {selection === 'unclassified' && (
        <p>現在の機械的な分類ルールに一致する変化を検出できなかった行です。</p>
      )}
      <div className="classification-scope">
        <span>
          {(count?.total ?? 0).toLocaleString('ja-JP')}件 · 要確認{' '}
          {(count?.review ?? 0).toLocaleString('ja-JP')}件
        </span>
        <label>
          <input
            id="only-review"
            type="checkbox"
            checked={onlyReview}
            onChange={event => onReview(event.target.checked)}
          />
          要確認のみ
        </label>
      </div>
    </section>
  )
}
