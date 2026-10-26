import path from 'node:path'

import { authorIndexFile } from '../comparison/authors.ts'
import {
  differenceFiles,
  readCompletedRun,
  readResults,
  validateAuthors
} from '../comparison/run-files.ts'
import { parseDifferenceLine, readLines } from '../infrastructure/jsonl.ts'
import { type AuthorKind, parseAuthorIndex } from '../protocol/authors.ts'
import type { ReportMetadata } from '../protocol/report.ts'
import { pageSize } from '../protocol/report.ts'
import { aggregateDifferences, reportDocument } from './aggregate.ts'

/** Assemble a report only from a complete run whose exact file bytes were verified. */
export async function buildReport(directory: string, template: string) {
  const { plan, manifest } = await readCompletedRun(directory)
  const results = await readResults(plan)
  let kinds: string | undefined
  if (manifest.files.some(file => file.path === authorIndexFile)) {
    const authors = parseAuthorIndex(
      await Bun.file(path.join(directory, authorIndexFile)).json()
    )
    validateAuthors(plan, authors, results.render.messages)
    kinds = authors.kinds
  }
  const aggregated = await aggregateDifferences(
    (async function* () {
      for (const file of differenceFiles)
        for await (const line of readLines(path.join(directory, file))) {
          const row = parseDifferenceLine(line)
          if (row.runId !== plan.runId)
            throw new Error('Difference belongs to a different comparison run')
          if (row.index >= results[row.profile].messages)
            throw new Error('Difference index exceeds message count')
          yield row
        }
    })(),
    pageSize,
    index => (kinds?.[index] ?? 'u') as AuthorKind
  )
  const metadata: ReportMetadata = {
    filters: aggregated.filters,
    authors: aggregated.authors,
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
