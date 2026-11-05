import { DifferenceList } from './DifferenceList.tsx'
import {
  ClassificationSummary,
  ClassificationTree
} from './components/ClassificationBrowser.tsx'
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
        <div className="classification-layout">
          <ClassificationTree
            selection={controller.controls.query.category ?? 'all'}
            counts={controller.classificationCounts}
            onSelect={controller.onCategory}
          />
          <div
            className="classification-content"
            aria-busy={controller.controls.loading}
          >
            <ClassificationSummary
              selection={controller.controls.query.category ?? 'all'}
              counts={controller.classificationCounts}
              onlyReview={controller.controls.query.onlyReview ?? false}
              onReview={controller.onReview}
            />
            {controller.rows.length > 0 && (
              <DifferenceList
                rows={controller.rows}
                classifications={controller.classifications}
                outputView={controller.outputView}
              />
            )}
            {controller.empty && <p id="empty">該当する差分はありません。</p>}
          </div>
        </div>
        <ReportFooter metadata={metadata} />
      </main>
    </>
  )
}
