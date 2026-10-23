import { expect, test } from 'bun:test'

import { type ReportMetadata, parseDifferenceRow } from '../report-schema.ts'
import { byMode } from '../shared/comparison.ts'
import {
  ReportRepository,
  parseReport,
  readEmbeddedReport
} from '../viewer/data/repository.ts'
import { aggregateDifferences, reportDocument } from './aggregate.ts'

test('report aggregation and repository share validated rows without building a viewer', async () => {
  const rows = [
    parseDifferenceRow({
      index: 0,
      mode: 'render',
      source: 'Alpha',
      before: 'a ',
      after: 'a'
    }),
    parseDifferenceRow({
      index: 1,
      mode: 'render',
      source: 'Beta',
      before: 'b',
      after: 'c',
      beforeType: 'html',
      afterType: 'error'
    }),
    parseDifferenceRow({
      index: 2,
      mode: 'plainText',
      source: 'Gamma',
      before: 'c',
      after: 'd'
    })
  ]
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  const timing = {
    calls: 3,
    totalMs: 1,
    meanUs: 1,
    p50Us: 1,
    p95Us: 1,
    p99Us: 1
  }
  const metadata: ReportMetadata = {
    messages: 3,
    counts: aggregate.counts,
    filters: aggregate.filters,
    pageSize: 1,
    generated: '2026-01-01T00:00:00Z',
    run: {
      warmups: 0,
      provenance: {
        before: byMode(() => ({ label: 'before', revision: 'a' })),
        after: { label: 'after', revision: 'b' },
        dependencies: {}
      }
    },
    results: byMode(mode => ({
      messages: 3,
      differences: aggregate.counts[mode],
      embeddingDifferences: 0,
      beforeErrors: 0,
      afterErrors: mode === 'render' ? 1 : 0,
      initialization: { beforeMs: 1, afterMs: 1 },
      before: timing,
      after: timing
    }))
  }
  const html = reportDocument(
    '<script type="application/json" id="metadata"></script><script type="application/json" id="payload"></script>',
    metadata,
    aggregate.payload
  )
  const document = {
    getElementById: (id: string) => ({
      textContent: html.match(new RegExp(`id="${id}">([^<]*)</script>`))![1]
    })
  }
  const data = readEmbeddedReport(document as unknown as Document)
  expect(() =>
    parseReport({ ...metadata, messages: 4 }, aggregate.payload)
  ).toThrow('message counts mismatch')
  expect(() =>
    parseReport(
      {
        ...metadata,
        results: {
          ...metadata.results,
          plainText: { ...metadata.results.plainText, differences: 2 }
        }
      },
      aggregate.payload
    )
  ).toThrow('counts mismatch')
  expect(readEmbeddedReport(document as unknown as Document)).toEqual(data)
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const found = await repository.query({
    mode: 'render',
    search: 'beta',
    ignoreWhitespace: true,
    page: 99
  })
  expect(found.rows).toEqual([rows[1]])
  expect(found.page).toBe(1)
  expect(found.totalHits).toBe(1)
  expect(found.rows[0].afterType).toBe('error')
  await repository.query({
    mode: 'render',
    search: 'beta',
    ignoreWhitespace: true,
    page: 1
  })
  expect(decodes).toBe(2)
  const controller = new AbortController()
  controller.abort()
  await expect(
    repository.query(
      { mode: 'render', search: '', ignoreWhitespace: false, page: 1 },
      controller.signal
    )
  ).rejects.toThrow()
})
