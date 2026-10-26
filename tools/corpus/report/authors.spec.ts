import { expect, test } from 'bun:test'

import { type AuthorKind } from '../protocol/authors.ts'
import { type DifferenceRow } from '../protocol/comparison.ts'
import { parseReport } from '../protocol/report.ts'
import { fixtureMetadata, fixtureRows } from '../testing/fixtures.ts'
import { ReportRepository } from '../viewer/data/repository.ts'
import { initialViewerState } from '../viewer/state.ts'
import { aggregateDifferences } from './aggregate.ts'

test('BOT filtering composes with normalization and search while retaining unknown authors', async () => {
  const rows: DifferenceRow[] = [
    { ...fixtureRows[0], source: 'human mentions BOT' },
    { ...fixtureRows[1], index: 1, source: 'a bot error' },
    {
      ...fixtureRows[0],
      index: 2,
      source: 'unknown BOT',
      before: { kind: 'html', value: 'before' },
      after: { kind: 'html', value: 'after' }
    },
    { ...fixtureRows[0], index: 3, source: 'bot whitespace' },
    { ...fixtureRows[2], index: 4 }
  ]
  const kinds: AuthorKind[] = ['h', 'b', 'u', 'b', 'b']
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1,
    index => kinds[index]
  )
  const metadata = {
    ...fixtureMetadata(aggregate.counts, 1, 5),
    filters: aggregate.filters,
    authors: aggregate.authors
  }
  const data = parseReport(metadata, aggregate.payload)
  expect(metadata.authors).toEqual({
    render: 'hbub',
    inline: '',
    plainText: 'b'
  })
  for (const invalid of ['hbu', 'hbux', 'hbubb'])
    expect(() =>
      parseReport(
        { ...metadata, authors: { ...metadata.authors, render: invalid } },
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
  const query = { ...initialViewerState.query, excludeBots: true }
  const first = await repository.query(query)
  expect(first.rows.map(row => row.source)).toEqual(['human mentions BOT'])
  expect(first.totalHits).toBe(2)
  expect(decodes).toBe(1)
  expect((await repository.query({ ...query, page: 2 })).rows[0].index).toBe(2)
  expect(
    (await repository.query({ ...query, ignoreWhitespace: true })).rows[0].index
  ).toBe(2)
  expect(
    (await repository.query({ ...query, ignoreWhitespace: true })).totalHits
  ).toBe(1)
  expect((await repository.query({ ...query, search: 'BOT' })).totalHits).toBe(
    2
  )
  expect(
    (await repository.query({ ...query, search: 'bot error' })).totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...query, profile: 'plainText' })).totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...query, excludeBots: false })).totalHits
  ).toBe(4)
})
