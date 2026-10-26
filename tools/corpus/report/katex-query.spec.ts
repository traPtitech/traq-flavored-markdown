import { expect, test } from 'bun:test'

import { parseReport } from '../protocol/report.ts'
import {
  fixtureKatexError,
  fixtureMetadata,
  fixtureRows
} from '../testing/fixtures.ts'
import { ReportRepository } from '../viewer/data/repository.ts'
import { initialViewerState } from '../viewer/state.ts'
import { aggregateDifferences } from './aggregate.ts'

test('indexed KaTeX filtering retains regressions and composes with cached queries', async () => {
  const rows = [
    fixtureKatexError,
    {
      ...fixtureKatexError,
      before: {
        kind: 'html' as const,
        value: '<p>OUTSIDE</p>' + fixtureKatexError.before.value
      },
      after: {
        kind: 'html' as const,
        value: '<p>outside</p>' + fixtureKatexError.after.value
      }
    },
    {
      ...fixtureKatexError,
      before: { kind: 'html' as const, value: '<p class="katex">success</p>' }
    },
    fixtureRows[1],
    {
      ...fixtureKatexError,
      before: {
        kind: 'html' as const,
        value: '<p>before</p>' + fixtureKatexError.before.value
      },
      after: {
        kind: 'html' as const,
        value: '<p>after</p>' + fixtureKatexError.after.value
      }
    },
    fixtureRows[2]
  ].map((row, index) => ({ ...row, index, source: `row ${index}` }))
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  expect(aggregate.excluded.render.katexErrors).toBe(1)
  expect(aggregate.excluded.render.caseAndKatexErrors).toBe(2)
  const metadata = {
    ...fixtureMetadata(aggregate.counts, 1, rows.length),
    filters: aggregate.filters
  }
  const data = parseReport(metadata, aggregate.payload)
  for (const invalid of ['0000'.repeat(5), '80000000'.repeat(5)])
    expect(() =>
      parseReport(
        { ...metadata, filters: { ...metadata.filters, render: invalid } },
        aggregate.payload
      )
    ).toThrow('Invalid report profile')
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = { ...initialViewerState.query, ignoreKatexErrors: true }
  const first = await repository.query(query)
  expect(first.rows[0].index).toBe(1)
  expect(first.totalHits).toBe(4)
  expect(decodes).toBe(1)
  const both = await repository.query({ ...query, ignoreCase: true })
  expect(both.rows[0].index).toBe(2)
  expect(both.totalHits).toBe(3)
  expect(decodes).toBe(2)
  expect(
    (await repository.query({ ...query, ignoreCase: true, search: 'row 0' }))
      .totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...query, ignoreCase: true, search: 'row 3' }))
      .rows[0].after.kind
  ).toBe('error')
  expect(
    (await repository.query({ ...query, profile: 'plainText' })).totalHits
  ).toBe(1)
  expect(
    (await repository.query({ ...query, ignoreKatexErrors: false })).totalHits
  ).toBe(5)
})
