import { expect, test } from 'bun:test'

import type { DifferenceRow } from '../protocol/comparison.ts'
import { parseReport } from '../protocol/report.ts'
import {
  fixtureHtmlSerialization,
  fixtureLinkedImage,
  fixtureMetadata,
  fixtureRows
} from '../testing/fixtures.ts'
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
    profile: 'render' as const,
    search: 'beta',
    ignoreWhitespace: true,
    ignoreCase: false,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    excludeBots: false,
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
    profile: 'render' as const,
    search: 'beta',
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    excludeBots: false,
    page: 1
  }
  await expect(repository.query(query, abort.signal)).rejects.toThrow()
  expect((await repository.query(query)).rows).toEqual([fixtureRows[1]])
})

test('case and whitespace filters compose with cached queries without decoding excluded chunks', async () => {
  const rows: DifferenceRow[] = [
    ['a ', 'a'],
    ['Alpha', 'alpha'],
    ['A b', 'ab'],
    ['before', 'after']
  ].map(([before, after], index) => ({
    ...fixtureRows[0],
    index,
    source: `row ${index}`,
    before: { kind: 'html', value: before },
    after: { kind: 'html', value: after }
  }))
  rows.push(
    {
      ...fixtureRows[0],
      index: 4,
      source: 'row 4',
      before: { kind: 'error', value: 'Error ' },
      after: { kind: 'error', value: 'error' }
    },
    {
      ...fixtureRows[0],
      index: 5,
      source: 'row 5',
      before: { kind: 'html', value: 'A ' },
      after: { kind: 'text', value: 'a' }
    }
  )
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  const data = parseReport(
    {
      ...fixtureMetadata(aggregate.counts, 1, rows.length),
      filters: aggregate.filters
    },
    aggregate.payload
  )
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = {
    profile: 'render' as const,
    search: '',
    ignoreWhitespace: true,
    ignoreCase: true,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    excludeBots: false,
    page: 1
  }
  const first = await repository.query(query)
  expect(first.rows.map(row => row.index)).toEqual([3])
  expect(first.totalHits).toBe(3)
  expect(decodes).toBe(1)
  for (const [ignoreWhitespace, ignoreCase, expected] of [
    [false, false, [0, 1, 2, 3, 4, 5]],
    [true, false, [1, 2, 3, 4, 5]],
    [false, true, [0, 2, 3, 4, 5]],
    [true, true, [3, 4, 5]]
  ] as const) {
    const found: number[] = []
    for (let page = 1; page <= expected.length; page++) {
      const result = await repository.query({
        ...query,
        ignoreWhitespace,
        ignoreCase,
        page
      })
      expect(result.totalHits).toBe(expected.length)
      found.push(...result.rows.map(row => row.index))
    }
    expect(found).toEqual([...expected])
  }
  expect(
    (await repository.query({ ...query, search: 'row 2' })).totalHits
  ).toBe(0)
  expect(
    (
      await repository.query({
        ...query,
        search: 'row 2',
        ignoreWhitespace: false
      })
    ).totalHits
  ).toBe(1)
})

test('linked-image indexes preserve mixed differences and compose all filter combinations without decoding excluded chunks', async () => {
  const rows: DifferenceRow[] = (
    [
      fixtureLinkedImage,
      {
        ...fixtureLinkedImage,
        before: { kind: 'html', value: fixtureLinkedImage.before.value + ' ' }
      },
      {
        ...fixtureLinkedImage,
        before: {
          kind: 'html',
          value: fixtureLinkedImage.before.value.replace('>badge<', '>BADGE<')
        }
      },
      {
        ...fixtureLinkedImage,
        before: {
          kind: 'html',
          value: fixtureLinkedImage.before.value.replace('>badge<', '>BAD GE<')
        }
      },
      {
        ...fixtureLinkedImage,
        after: {
          kind: 'html',
          value: fixtureLinkedImage.after.value + '<p>different</p>'
        }
      },
      fixtureRows[1]
    ] satisfies DifferenceRow[]
  ).map((row, index) => ({ ...row, index, source: `image row ${index}` }))
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  expect(aggregate.excluded.render.linkedImages).toBe(1)
  expect(aggregate.excluded.render.whitespaceAndCaseAndLinkedImages).toBe(4)
  const data = parseReport(
    {
      ...fixtureMetadata(aggregate.counts, 1, rows.length),
      filters: aggregate.filters
    },
    aggregate.payload
  )
  expect(() =>
    parseReport(
      {
        ...data.metadata,
        filters: { ...data.metadata.filters, render: '0'.repeat(rows.length) }
      },
      data.payload
    )
  ).toThrow('Invalid report profile')
  for (const invalid of ['8000', '00gg', 'f000'])
    expect(() =>
      parseReport(
        {
          ...data.metadata,
          filters: {
            ...data.metadata.filters,
            render: invalid.repeat(rows.length)
          }
        },
        data.payload
      )
    ).toThrow('Invalid report profile')
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = {
    profile: 'render' as const,
    search: '',
    ignoreWhitespace: true,
    ignoreCase: true,
    ignoreLinkedImages: true,
    ignoreHtmlSerialization: false,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    excludeBots: false,
    page: 1
  }
  expect((await repository.query(query)).rows.map(row => row.index)).toEqual([
    4
  ])
  expect(decodes).toBe(1)
  for (const [ignoreWhitespace, ignoreCase, expected] of [
    [false, false, [1, 2, 3, 4, 5]],
    [true, false, [2, 3, 4, 5]],
    [false, true, [1, 3, 4, 5]],
    [true, true, [4, 5]]
  ] as const) {
    const found: number[] = []
    for (let page = 1; page <= expected.length; page++) {
      const result = await repository.query({
        ...query,
        ignoreWhitespace,
        ignoreCase,
        page
      })
      expect(result.totalHits).toBe(expected.length)
      found.push(...result.rows.map(row => row.index))
    }
    expect(found).toEqual([...expected])
  }
  expect(
    (await repository.query({ ...query, ignoreLinkedImages: false })).totalHits
  ).toBe(rows.length)
  expect(
    (await repository.query({ ...query, search: 'image row 0' })).totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...query, search: 'image row 4' })).rows.map(
      row => row.index
    )
  ).toEqual([4])
})

test('HTML spelling filters compose with cached search and reject the previous index width', async () => {
  const rows: DifferenceRow[] = (
    [
      fixtureHtmlSerialization,
      {
        ...fixtureHtmlSerialization,
        after: {
          kind: 'html',
          value: fixtureHtmlSerialization.after.value + '<br>'
        }
      },
      fixtureRows[1]
    ] satisfies DifferenceRow[]
  ).map((row, index) => ({ ...row, index, source: `HTML row ${index}` }))
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1
  )
  expect(aggregate.excluded.render.htmlSerialization).toBe(1)
  const data = parseReport(
    {
      ...fixtureMetadata(aggregate.counts, 1, rows.length),
      filters: aggregate.filters
    },
    aggregate.payload
  )
  expect(() =>
    parseReport(
      {
        ...data.metadata,
        filters: { ...data.metadata.filters, render: '00'.repeat(rows.length) }
      },
      data.payload
    )
  ).toThrow('Invalid report profile')
  let decodes = 0
  const repository = new ReportRepository(data, async encoded => {
    decodes++
    return JSON.parse(
      new TextDecoder().decode(Bun.gunzipSync(Buffer.from(encoded, 'base64')))
    )
  })
  const query = {
    profile: 'render' as const,
    search: '',
    ignoreWhitespace: false,
    ignoreCase: false,
    ignoreLinkedImages: false,
    ignoreHtmlSerialization: true,
    ignoreKatexErrors: false,
    ignoreLinkPolicy: false,
    excludeBots: false,
    page: 1
  }
  expect((await repository.query(query)).rows.map(row => row.index)).toEqual([
    1
  ])
  expect(decodes).toBe(1)
  expect(
    (await repository.query({ ...query, search: 'HTML row 0' })).totalHits
  ).toBe(0)
  expect(
    (await repository.query({ ...query, search: 'HTML row 2' })).rows[0].after
      .kind
  ).toBe('error')
  expect(
    (await repository.query({ ...query, ignoreHtmlSerialization: false }))
      .totalHits
  ).toBe(3)
})
