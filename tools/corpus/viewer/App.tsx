import DiffTable from './DiffTable.tsx'
import { ComparisonControls } from './components/ComparisonControls.tsx'
import { ReportFooter } from './components/ReportFooter.tsx'
import { ReportHeader } from './components/ReportHeader.tsx'
import type { ReportRepository } from './data/repository.ts'
import { useViewerController } from './hooks/useViewerController.ts'

export default function App({
  repository
}: {
  repository: ReportRepository | null
}) {
  const controller = useViewerController(repository)
  if (!repository)
    return (
      <main style={{ padding: 20 }}>
        <p id="status">
          読込に失敗しました。新しい Chrome / Edge
          で開いてください。（またはデータがありません）
        </p>
      </main>
    )
  const metadata = repository.metadata
  const rows = controller.result?.rows ?? []
  return (
    <>
      <ReportHeader metadata={metadata} />
      <main>
        <ComparisonControls metadata={metadata} controller={controller} />
        {rows.length > 0 ? (
          <DiffTable rows={rows} outputView={controller.state.outputView} />
        ) : (
          <p
            id="empty"
            hidden={controller.loading || controller.totalHits !== 0}
          >
            該当する差分はありません。
          </p>
        )}
        <ReportFooter metadata={metadata} />
      </main>
    </>
  )
}
