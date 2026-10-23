import path from 'node:path'

import {
  differenceFiles,
  readCompletedRun,
  readResults
} from '../comparison/run-files.ts'
import { parseDifferenceLine, readLines } from '../infrastructure/jsonl.ts'
import type { ReportMetadata } from '../protocol/report.ts'
import { aggregateDifferences, reportDocument } from './aggregate.ts'

/** Assemble a report only from a complete run whose exact file bytes were verified. */
export async function buildReport(directory: string, template: string) {
  const { plan } = await readCompletedRun(directory)
  const aggregated = await aggregateDifferences(
    (async function* () {
      for (const file of differenceFiles)
        for await (const line of readLines(path.join(directory, file))) {
          const row = parseDifferenceLine(line)
          if (row.runId !== plan.runId)
            throw new Error('Difference belongs to a different comparison run')
          yield row
        }
    })()
  )
  const results = await readResults(plan)
  const metadata: ReportMetadata = {
    filters: aggregated.filters,
    counts: aggregated.counts,
    messages: results.render.messages,
    results,
    run: {
      runId: plan.runId,
      corpusSha256: plan.corpusSha256,
      warmups: plan.warmups,
      provenance: plan.provenance,
      environment: plan.environment
    },
    generated: new Date().toISOString(),
    pageSize: aggregated.pageSize
  }
  return {
    html: reportDocument(template, metadata, aggregated.payload),
    metadata,
    excluded: aggregated.excluded
  }
}
