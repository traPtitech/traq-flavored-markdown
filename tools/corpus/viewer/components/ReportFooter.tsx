import { type ReportMetadata, profilesFor } from '../../protocol/report.ts'
import { profileLabels } from '../profiles.ts'

export function ReportFooter({ metadata }: { metadata: ReportMetadata }) {
  return (
    <footer id="footer">
      生成 {new Date(metadata.generated).toLocaleString('ja-JP')}
      {profilesFor(metadata.run).map(profile => (
        <span key={profile}>
          {' · '}
          {profileLabels[profile]} before{' '}
          {metadata.run.provenance.before[profile]!.revision.slice(0, 10)}
        </span>
      ))}
      {' · after: '}
      {metadata.run.provenance.after.label}{' '}
      {metadata.run.provenance.after.revision.slice(0, 10)}
      {metadata.run.provenance.after.dirty ? '（未コミットの変更あり）' : ''}
      {' · 外部画像はプレースホルダー表示。リンク・スクリプトは実行しません。'}
      <details className="provenance">
        <summary>比較の実行情報</summary>
        <dl>
          <dt>実行 ID</dt>
          <dd>{metadata.run.runId}</dd>
          <dt>コーパス SHA-256</dt>
          <dd>{metadata.run.corpusSha256}</dd>
          <dt>Wasm SHA-256</dt>
          <dd>{metadata.run.provenance.artifacts.wasmSha256}</dd>
          <dt>JavaScript SHA-256</dt>
          <dd>{metadata.run.provenance.artifacts.javascriptSha256}</dd>
          <dt>コントラクト</dt>
          <dd>{metadata.run.provenance.artifacts.contractId}</dd>
          <dt>ソース fingerprint</dt>
          <dd>{metadata.run.provenance.artifacts.sourceFingerprint}</dd>
          <dt>実行環境</dt>
          <dd>
            Bun {metadata.run.environment.bun} / {metadata.run.environment.go} /{' '}
            {metadata.run.environment.platform} {metadata.run.environment.arch}
          </dd>
        </dl>
        {Object.entries(metadata.run.provenance.dependencies).map(
          ([name, versions]) => (
            <p key={name}>
              {name}: before {versions.before} / after {versions.after}
            </p>
          )
        )}
      </details>
    </footer>
  )
}
