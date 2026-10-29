import { expect, test } from 'bun:test'

import {
  encodeFilterMasks,
  filterMaskAt,
  parseReport
} from '../protocol/report.ts'
import { fixtureMetadata, fixtureRows } from '../testing/fixtures.ts'
import { ReportRepository } from '../viewer/data/repository.ts'
import { initialViewerState } from '../viewer/state.ts'
import { aggregateDifferences } from './aggregate.ts'

test('link policy indexes compose with cached queries and keep mixed changes and errors', async () => {
  const url = 'trap.jp'
  const rows = [
    {
      ...fixtureRows[0],
      index: 0,
      source: url,
      before: {
        kind: 'html' as const,
        value: `<a href="http://${url}">${url}</a>`
      },
      after: { kind: 'html' as const, value: url }
    },
    {
      ...fixtureRows[0],
      index: 1,
      source: 'mixed case ' + url,
      before: {
        kind: 'html' as const,
        value: `A <a href="http://${url}">${url}</a>`
      },
      after: { kind: 'html' as const, value: 'a ' + url }
    },
    {
      ...fixtureRows[0],
      index: 2,
      source: 'mixed text ' + url,
      before: {
        kind: 'html' as const,
        value: `before <a href="http://${url}">${url}</a>`
      },
      after: { kind: 'html' as const, value: 'after ' + url }
    },
    { ...fixtureRows[1], index: 3, source: 'failure ' + url },
    {
      ...fixtureRows[2],
      index: 4,
      source: '<README.md>',
      before: { kind: 'text' as const, value: '<README.md>' },
      after: { kind: 'text' as const, value: 'README.md' }
    }
  ]
  const aggregated = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  expect(aggregated.excluded.render.linkPolicy).toBe(1)
  expect(aggregated.excluded.render.caseAndLinkPolicy).toBe(2)
  const metadata = {
    ...fixtureMetadata(aggregated.counts, 1, rows.length),
    filters: aggregated.filters
  }
  const decoded: string[] = []
  const repository = new ReportRepository(
    parseReport(metadata, aggregated.payload),
    async encoded => {
      decoded.push(encoded)
      return JSON.parse(
        new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
      )
    }
  )
  const query = { ...initialViewerState.query, ignoreLinkPolicy: true }
  expect((await repository.query(query)).rows[0].index).toBe(1)
  expect(decoded).toHaveLength(1)
  expect(decoded).not.toContain(aggregated.payload.render[0])
  const combined = {
    ...query,
    ignoreCase: true,
    ignoreWhitespace: true,
    ignoreLinkedImages: true,
    ignoreHtmlSerialization: true,
    ignoreKatexErrors: true
  }
  const found = await repository.query(combined)
  expect(found.totalHits).toBe(2)
  expect(found.rows[0].index).toBe(2)
  const reads = decoded.length
  expect(
    (await repository.query({ ...combined, page: 2 })).rows[0].after.kind
  ).toBe('error')
  expect(decoded.length).toBe(reads + 1)
  await repository.query(combined)
  expect(decoded.length).toBe(reads + 1)
  expect(
    (await repository.query({ ...combined, profile: 'plainText' })).totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...combined, search: 'mixed' })).totalHits
  ).toBe(1)
  expect(
    (await repository.query({ ...combined, ignoreLinkPolicy: false })).totalHits
  ).toBe(4)
  expect(() =>
    parseReport(
      {
        ...metadata,
        filters: {
          ...metadata.filters,
          render: '0'.repeat(aggregated.counts.render * 8)
        }
      },
      aggregated.payload
    )
  ).toThrow('Invalid report profile')
})

test('report masks retain the highest filter combination without number truncation', () => {
  const mask = 1n << 62n
  const encoded = encodeFilterMasks([mask, 0n])
  expect(encoded).toHaveLength(32)
  expect(filterMaskAt(encoded, 0)).toBe(mask)
  expect(filterMaskAt(encoded, 1)).toBe(0n)
})

test('HTTPS completion and email additions are indexed without hiding wrong destinations', async () => {
  const rows = [
    {
      ...fixtureRows[0],
      index: 0,
      source: '//trap.jp',
      before: {
        kind: 'html' as const,
        value: '<a href="//trap.jp">//trap.jp</a>'
      },
      after: {
        kind: 'html' as const,
        value: '<a href="https://trap.jp">//trap.jp</a>'
      }
    },
    {
      ...fixtureRows[0],
      index: 1,
      source: 'info@example.unknown',
      before: { kind: 'html' as const, value: 'info@example.unknown' },
      after: {
        kind: 'html' as const,
        value: '<a href="mailto:info@example.unknown">info@example.unknown</a>'
      }
    },
    {
      ...fixtureRows[0],
      index: 2,
      source: '//trap.jp',
      before: {
        kind: 'html' as const,
        value: '<a href="//trap.jp">//trap.jp</a>'
      },
      after: {
        kind: 'html' as const,
        value: '<a href="https://wrong.test">//trap.jp</a>'
      }
    }
  ]
  const aggregated = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  const metadata = {
    ...fixtureMetadata(aggregated.counts, 1, rows.length),
    filters: aggregated.filters
  }
  const decoded: string[] = []
  const repository = new ReportRepository(
    parseReport(metadata, aggregated.payload),
    async encoded => {
      decoded.push(encoded)
      return JSON.parse(
        new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
      )
    }
  )
  const result = await repository.query({
    ...initialViewerState.query,
    ignoreLinkPolicy: true
  })
  expect(result.totalHits).toBe(1)
  expect(result.rows[0].index).toBe(2)
  expect(decoded).toEqual([aggregated.payload.render[2]])
})
