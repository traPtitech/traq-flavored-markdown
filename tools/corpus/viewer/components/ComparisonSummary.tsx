import type { ProfileResult } from '../../protocol/comparison.ts'
import { type ProfileId, profileIds } from '../../protocol/report.ts'
import { profileLabels } from '../profiles.ts'

export function ComparisonSummary({
  results
}: {
  results: Record<ProfileId, ProfileResult>
}) {
  return (
    <section className="result-summary" aria-label="比較結果">
      <table>
        <caption>
          比較結果（同じエラーになった結果もエラー件数に含みます）
        </caption>
        <thead>
          <tr>
            <th>表示</th>
            <th>出力差分</th>
            <th>before エラー</th>
            <th>after エラー</th>
            <th>埋め込み差分</th>
          </tr>
        </thead>
        <tbody>
          {profileIds.map(profile => {
            const result = results[profile]
            return (
              <tr key={profile} data-profile={profile}>
                <th>{profileLabels[profile]}</th>
                <td>{result.differences.toLocaleString('ja-JP')}</td>
                <td className={result.beforeErrors ? 'has-errors' : undefined}>
                  {result.beforeErrors.toLocaleString('ja-JP')}
                </td>
                <td className={result.afterErrors ? 'has-errors' : undefined}>
                  {result.afterErrors.toLocaleString('ja-JP')}
                </td>
                <td>{result.embeddingDifferences.toLocaleString('ja-JP')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
