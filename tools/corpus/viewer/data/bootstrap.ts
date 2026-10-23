import { ReportRepository, readEmbeddedReport } from './repository.ts'

export type BootstrapResult =
  | { status: 'ready'; repository: ReportRepository }
  | {
      status: 'failed'
      reason: 'missing-data' | 'invalid-data' | 'unsupported-browser'
      message: string
      detail?: string
    }

export function bootstrapReport(
  document: Pick<Document, 'getElementById'>,
  canDecompress = typeof DecompressionStream !== 'undefined'
): BootstrapResult {
  if (
    !document.getElementById('metadata')?.textContent?.trim() ||
    !document.getElementById('payload')?.textContent?.trim()
  )
    return {
      status: 'failed',
      reason: 'missing-data',
      message: '比較データがありません。生成されたレポートを開いてください。'
    }
  if (!canDecompress)
    return {
      status: 'failed',
      reason: 'unsupported-browser',
      message:
        'このブラウザはレポートの展開に対応していません。新しい Chrome / Edge で開いてください。'
    }
  try {
    return {
      status: 'ready',
      repository: new ReportRepository(readEmbeddedReport(document))
    }
  } catch (error) {
    return {
      status: 'failed',
      reason: 'invalid-data',
      message:
        '比較データが壊れているか、形式が一致しません。レポートを再生成してください。',
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}
