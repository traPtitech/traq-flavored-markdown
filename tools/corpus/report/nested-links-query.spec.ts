import { expect, test } from 'bun:test'

import { encodeFilterMasks, parseReport } from '../protocol/report.ts'
import { fixtureMetadata, fixtureNestedLink } from '../testing/fixtures.ts'
import { ReportRepository } from '../viewer/data/repository.ts'
import { initialViewerState } from '../viewer/state.ts'
import { aggregateDifferences } from './aggregate.ts'

test('nested-link indexes compose with other filters, pagination, search, authors and cached queries', async () => {
  const rows = [
    { ...fixtureNestedLink, index: 0 },
    {
      ...fixtureNestedLink,
      index: 1,
      source: 'case ' + fixtureNestedLink.source,
      before: {
        kind: 'html' as const,
        value: 'A ' + fixtureNestedLink.before.value
      },
      after: {
        kind: 'html' as const,
        value: 'a ' + fixtureNestedLink.after.value
      }
    },
    {
      ...fixtureNestedLink,
      index: 2,
      source: 'mixed ' + fixtureNestedLink.source,
      after: {
        kind: 'html' as const,
        value: fixtureNestedLink.after.value + '<br>'
      }
    },
    {
      ...fixtureNestedLink,
      index: 3,
      source: 'failure ' + fixtureNestedLink.source,
      after: { kind: 'error' as const, value: 'failed' }
    },
    { ...fixtureNestedLink, index: 4, profile: 'inline' as const }
  ]

  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1,
    index => (index === 3 ? 'b' : 'h')
  )

  expect(aggregate.excluded.render.nestedLinks).toBe(1)
  expect(aggregate.excluded.render.caseAndNestedLinks).toBe(2)
  expect(aggregate.excluded.inline.nestedLinks).toBe(1)

  const metadata = {
    ...fixtureMetadata(aggregate.counts, 1, rows.length),
    filters: aggregate.filters,
    authors: aggregate.authors
  }

  const decoded: string[] = []

  const repository = new ReportRepository(
    parseReport(metadata, aggregate.payload),
    async encoded => {
      decoded.push(encoded)

      return JSON.parse(
        new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
      )
    }
  )

  const query = { ...initialViewerState.query, ignoreNestedLinks: true }
  const first = await repository.query(query)
  expect(first.rows[0].index).toBe(1)
  expect(first.totalHits).toBe(3)
  expect(decoded).toEqual([aggregate.payload.render[1]])

  const combined = {
    ...query,
    ignoreWhitespace: true,
    ignoreCase: true,
    ignoreLinkedImages: true,
    ignoreHtmlSerialization: true,
    ignoreKatexErrors: true,
    ignoreLinkPolicy: true
  }

  const found = await repository.query(combined)
  expect(found.totalHits).toBe(2)
  expect(found.rows[0].index).toBe(2)

  expect(
    (await repository.query({ ...combined, page: 2 })).rows[0].after.kind
  ).toBe('error')

  const reads = decoded.length
  await repository.query(combined)
  expect(decoded).toHaveLength(reads)

  expect(
    (await repository.query({ ...combined, ignoreNestedLinks: false }))
      .totalHits
  ).toBe(4)

  expect(
    (await repository.query({ ...combined, profile: 'inline' })).totalHits
  ).toBe(0)

  expect(
    (await repository.query({ ...combined, search: 'mixed' })).rows[0].index
  ).toBe(2)

  expect(
    (await repository.query({ ...combined, excludeBots: true })).totalHits
  ).toBe(1)

  for (const render of [
    '0'.repeat(aggregate.counts.render * 16),
    encodeFilterMasks([1n << 127n, 0n, 0n, 0n])
  ]) {
    expect(() =>
      parseReport(
        { ...metadata, filters: { ...metadata.filters, render } },
        aggregate.payload
      )
    ).toThrow('Invalid report profile')
  }
})
