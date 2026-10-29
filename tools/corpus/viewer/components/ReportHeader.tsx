import { type ReportMetadata, profilesFor } from '../../protocol/report.ts'
import { profileLabels } from '../profiles.ts'

const number = (value: number) =>
  value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })

export function ReportHeader({ metadata }: { metadata: ReportMetadata }) {
  return (
    <header className="top">
      <div>
        <p className="eyebrow">BEFORE → AFTER</p>
        <h1>Markdown 差分一覧</h1>
        <p id="overview">
          {number(metadata.messages)} 件を比較 · 差分のある結果のみ · 1ページ{' '}
          {number(metadata.pageSize)}件 · 単独ファイルでオフライン閲覧
        </p>
      </div>
      <details className="speed">
        <summary>速度比較（参考）</summary>
        <div id="speed">
          <SpeedTable metadata={metadata} />
          <p>
            同一入力でウォームアップ後に計測（指定上限{' '}
            {number(metadata.run.warmups)} 件）。before / after
            の実行順は交互。収集・ファイル出力・画面表示の時間は含みません。各モードを順に実行した際の参考値です。
          </p>
          {profilesFor(metadata.run).map(profile => (
            <p key={profile}>
              {profileLabels[profile]} ウォームアップ実施:{' '}
              {number(metadata.results[profile]!.actualWarmups)} 件。初期化:
              before{' '}
              {number(metadata.results[profile]!.initialization.beforeMs)} ms /
              after {number(metadata.results[profile]!.initialization.afterMs)}{' '}
              ms。
            </p>
          ))}
          <p>
            S-UI は同一の固定参照・スタンプデータを使用。
            {metadata.results.plainText &&
              'traQ は選択したリビジョンの Parse と Rust PlainTextRenderer が返すプレーンテキストを比較。'}
            モジュール読込は除きます。
          </p>
        </div>
      </details>
    </header>
  )
}

function SpeedTable({ metadata }: { metadata: ReportMetadata }) {
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
        {profilesFor(metadata.run).map(profile => {
          const data = metadata.results[profile]!
          return (
            <tr key={profile}>
              <td>{profileLabels[profile]}</td>
              <td>
                {number(data.before.meanUs)} / {number(data.after.meanUs)}
              </td>
              <td>
                {number(data.before.p50Us)} / {number(data.after.p50Us)}
              </td>
              <td>
                {number(data.before.p95Us)} / {number(data.after.p95Us)}
              </td>
              <td>
                {data.before.meanUs > 0
                  ? `${number(data.after.meanUs / data.before.meanUs)} 倍`
                  : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
