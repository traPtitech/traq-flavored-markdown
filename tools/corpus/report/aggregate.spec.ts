import { expect, test } from 'bun:test'

import { parseReport } from '../protocol/report.ts'
import { fixtureMetadata, fixtureRows } from '../testing/fixtures.ts'
import {
  ReportRepository,
  readEmbeddedReport
} from '../viewer/data/repository.ts'
import { aggregateDifferences, reportDocument } from './aggregate.ts'

test('aggregation, validation, filtering and cached querying share the same run outcomes', async () => {
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* fixtureRows
    })(),
    1
  )
  const metadata = {
    ...fixtureMetadata(aggregate.counts, 1),
    filters: aggregate.filters
  }
  const html = reportDocument(
    '<script type="application/json" id="metadata"></script><script type="application/json" id="payload"></script>',
    metadata,
    aggregate.payload
  )
  const document = {
    getElementById: (id: string) => ({
      textContent: html.match(
        new RegExp('id="' + id + '">([^<]*)</script>')
      )![1]
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
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = {
    mode: 'render' as const,
    search: 'beta',
    ignoreWhitespace: true,
    page: 99
  }
  const found = await repository.query(query)
  expect(found.rows).toEqual([fixtureRows[1]])
  expect(found.page).toBe(1)
  expect(found.totalHits).toBe(1)
  expect(found.rows[0].after.kind).toBe('error')
  await repository.query({ ...query, page: 1 })
  expect(decodes).toBe(2)
  const controller = new AbortController()
  controller.abort()
  await expect(repository.query(query, controller.signal)).rejects.toThrow()
})

test('query cancellation cannot publish a partially scanned filter index', async () => {
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* fixtureRows
    })(),
    1
  )
  const data = parseReport(
    { ...fixtureMetadata(aggregate.counts, 1), filters: aggregate.filters },
    aggregate.payload
  )
  const abort = new AbortController()
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    if (decodes === 1) abort.abort()
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = {
    mode: 'render' as const,
    search: 'beta',
    ignoreWhitespace: false,
    page: 1
  }
  await expect(repository.query(query, abort.signal)).rejects.toThrow()
  expect((await repository.query(query)).rows).toEqual([fixtureRows[1]])
})
