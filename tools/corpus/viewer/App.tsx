import DiffTable from './DiffTable.tsx'
import { ComparisonControls } from './components/ComparisonControls.tsx'
import { ComparisonSummary } from './components/ComparisonSummary.tsx'
import { ReportFooter } from './components/ReportFooter.tsx'
import { ReportHeader } from './components/ReportHeader.tsx'
import type { BootstrapResult } from './data/bootstrap.ts'
import type { ReportRepository } from './data/repository.ts'
import { useViewerController } from './hooks/useViewerController.ts'

export default function App({ bootstrap }: { bootstrap: BootstrapResult }) {
  return bootstrap.status === 'ready' ? (
    <ReportViewer repository={bootstrap.repository} />
  ) : (
    <main className="bootstrap-error" data-reason={bootstrap.reason}>
      <h1>レポートを読み込めません</h1>
      <p role="alert">{bootstrap.message}</p>
      {bootstrap.detail && <pre>{bootstrap.detail}</pre>}
    </main>
  )
}

function ReportViewer({ repository }: { repository: ReportRepository }) {
  const controller = useViewerController(repository)
  const metadata = repository.metadata
  return (
    <>
      <ReportHeader metadata={metadata} />
      <main>
        <ComparisonSummary results={metadata.results} />
        <ComparisonControls {...controller.controls} />
        {controller.rows.length > 0 && (
          <DiffTable
            rows={controller.rows}
            outputView={controller.outputView}
          />
        )}
        {controller.empty && <p id="empty">該当する差分はありません。</p>}
        <ReportFooter metadata={metadata} />
      </main>
    </>
  )
}
