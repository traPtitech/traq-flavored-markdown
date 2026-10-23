import { type ReportMetadata, profileIds } from '../../protocol/report.ts'
import { profileLabels } from '../profiles.ts'

export function ReportFooter({ metadata }: { metadata: ReportMetadata }) {
  return (
    <footer id="footer">
      生成 {new Date(metadata.generated).toLocaleString('ja-JP')}
      {profileIds.map(mode => (
        <span key={mode}>
          {' · '}
          {profileLabels[mode]} before{' '}
          {metadata.run.provenance.before[mode].revision.slice(0, 10)}
        </span>
      ))}
      {' · after: '}
      {metadata.run.provenance.after.label}{' '}
      {metadata.run.provenance.after.revision.slice(0, 10)}
      {' · 外部画像はプレースホルダー表示。リンク・スクリプトは実行しません。'}
    </footer>
  )
}
