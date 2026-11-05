import { expect, test } from 'bun:test'

import {
  type Classification,
  classificationAt,
  classificationVersion,
  encodeClassification,
  needsReview,
  validClassifications
} from '../protocol/classification.ts'
import type { DifferenceRow } from '../protocol/comparison.ts'
import { parseReport } from '../protocol/report.ts'
import {
  fixtureKatexError,
  fixtureLinkedImage,
  fixtureMetadata,
  fixtureRows
} from '../testing/fixtures.ts'
import { ReportRepository } from '../viewer/data/repository.ts'
import { initialViewerState } from '../viewer/state.ts'
import { aggregateDifferences } from './aggregate.ts'
import { classifyDifference } from './classify.ts'

const row = (before: string, after: string, source = ''): DifferenceRow => ({
  ...fixtureRows[0],
  source,
  before: { kind: 'html', value: before },
  after: { kind: 'html', value: after }
})

test('classification proves full coverage while keeping mixed and unknown residuals visible', () => {
  const accepted = classifyDifference(fixtureLinkedImage)
  expect(accepted).toEqual({ tags: ['image.linked'], complete: true })
  expect(needsReview(accepted)).toBe(false)
  const mixed = {
    ...fixtureLinkedImage,
    before: {
      kind: 'html' as const,
      value: fixtureLinkedImage.before.value + ' old'
    },
    after: {
      kind: 'html' as const,
      value: fixtureLinkedImage.after.value + ' new'
    }
  }
  const partial = classifyDifference(mixed)
  expect(partial.tags).toContain('image.linked')
  expect(partial.complete).toBe(false)
  expect(needsReview(partial)).toBe(true)
  expect(classifyDifference(row('old', 'new'))).toEqual({
    tags: [],
    complete: false
  })
  // An unchanged image in a message is not evidence of an image difference.
  expect(
    classifyDifference(
      row(
        fixtureLinkedImage.after.value + ' old',
        fixtureLinkedImage.after.value + ' new',
        fixtureLinkedImage.source
      )
    ).tags
  ).not.toContain('image.linked')
})

test('structural, color and diagnostic rules inspect changed outputs and protect literal contexts', () => {
  expect(classifyDifference(row('<p>a<br>b</p>', 'ab')).tags).toEqual([
    'block.breaks',
    'block.paragraph'
  ])
  expect(classifyDifference(row('<p>a<br>b</p>', 'ab')).complete).toBe(true)
  expect(
    classifyDifference(row('<code>&lt;br&gt;</code>', '<code></code>')).tags
  ).not.toContain('block.breaks')
  expect(
    classifyDifference(row('<p title="old">a</p>', '<p title="new">a</p>'))
      .complete
  ).toBe(false)
  const color = (value: string) =>
    `<i class="emoji message-emoji" title=":0x${value}:" style="background-color: #${value};">:0x${value}:</i>`
  expect(classifyDifference(row(color('FF0000'), color('ff0000')))).toEqual({
    tags: ['stamp.hex_case'],
    complete: true
  })
  expect(
    classifyDifference(row(color('FF0000') + ' old', color('FF0000') + ' new'))
      .tags
  ).not.toContain('stamp.hex_case')
  expect(classifyDifference(fixtureKatexError).tags).toContain(
    'math.diagnostic'
  )
  expect(classifyDifference(fixtureRows[1])).toEqual({
    tags: ['error.after'],
    complete: true
  })
})

test('classification indexes validate version, bit ranges, lengths and coverage independently of exclusion combinations', () => {
  const value: Classification = {
    tags: ['image.linked', 'block.breaks'],
    complete: true
  }
  const encoded = encodeClassification({ ...value, tags: [...value.tags] })
  expect(classificationAt(encoded, 0)).toEqual(value)
  expect(validClassifications(encoded, 1)).toBe(true)
  for (const invalid of [
    '8000000000000000',
    '4000000000000000',
    'not hexadecimal',
    encoded.slice(1)
  ])
    expect(validClassifications(invalid, 1)).toBe(false)
  const metadata = fixtureMetadata()
  expect(() =>
    parseReport(
      { ...metadata, classificationVersion: classificationVersion + '-old' },
      { render: [], inline: [], plainText: [] }
    )
  ).toThrow('classification version')
})

test('inline image and list-number changes have separate mechanical rules', () => {
  expect(
    classifyDifference({ ...row('text  here', 'text here'), profile: 'inline' })
  ).toEqual({ tags: ['text.inline_spacing'], complete: true })
  expect(
    classifyDifference({
      ...row('<code>a b</code>', '<code>ab</code>'),
      profile: 'inline'
    })
  ).toEqual({ tags: ['text.whitespace'], complete: true })
  const single = {
    ...row(
      '!<a href="https://example.test/img" target="_blank" rel="nofollow noopener noreferrer">alt</a>',
      '<a href="https://example.test/img" data-is-image>alt</a>'
    ),
    profile: 'inline' as const
  }
  expect(classifyDifference(single)).toEqual({
    tags: ['image.inline'],
    complete: true
  })
  expect(
    classifyDifference({
      ...single,
      after: {
        kind: 'html',
        value: '<a href="https://wrong.test/img" data-is-image>alt</a>'
      }
    }).complete
  ).toBe(false)
  expect(
    classifyDifference({
      ...fixtureLinkedImage,
      profile: 'inline',
      after: {
        kind: 'html',
        value: fixtureLinkedImage.after.value.replace('!badge', 'badge')
      }
    })
  ).toEqual({ tags: ['image.inline_linked'], complete: true })
  const numbered = {
    ...row('1. a 1. b', '1. a 2. b', '1. a\n1. b'),
    profile: 'inline' as const
  }
  expect(classifyDifference(numbered)).toEqual({
    tags: ['block.numbering'],
    complete: true
  })
  expect(
    classifyDifference({
      ...numbered,
      before: { kind: 'html', value: '<code>1. a 1. b</code>' },
      after: { kind: 'html', value: '<code>1. a 2. b</code>' }
    }).complete
  ).toBe(false)
  const domain = classifyDifference(
    row(
      '<p><a href="http://example.test">example.test</a></p>',
      '<p>example.test</p>',
      'example.test'
    )
  )
  expect(domain).toEqual({ tags: ['link.domain'], complete: true })
})

test('category counts and review filtering compose with search, authors, pagination and cached queries without decoding excluded rows', async () => {
  const rows: DifferenceRow[] = [
    { ...fixtureLinkedImage, index: 0, source: 'image accepted' },
    {
      ...fixtureLinkedImage,
      index: 1,
      source: 'image mixed',
      before: { kind: 'html', value: fixtureLinkedImage.before.value + ' old' },
      after: { kind: 'html', value: fixtureLinkedImage.after.value + ' new' }
    },
    { ...fixtureRows[1], index: 2, source: 'error' },
    { ...fixtureRows[0], index: 3, source: 'whitespace' }
  ]
  const aggregate = await aggregateDifferences(
    (async function* () {
      yield* rows
    })(),
    1,
    index => (index === 1 ? 'b' : 'h')
  )
  const metadata = {
    ...fixtureMetadata(aggregate.counts, 1, 4),
    filters: aggregate.filters,
    classifications: aggregate.classifications,
    authors: aggregate.authors
  }
  let decodes = 0
  const repository = new ReportRepository(
    parseReport(metadata, aggregate.payload),
    async value => {
      decodes++
      return JSON.parse(
        new TextDecoder().decode(Bun.gunzipSync(Buffer.from(value, 'base64')))
      )
    }
  )
  const base = initialViewerState.query
  const images = await repository.query({ ...base, category: 'image' })
  expect(images.totalHits).toBe(2)
  expect(images.classificationCounts.image).toEqual({ total: 2, review: 1 })
  expect(images.classificationCounts.residual.total).toBe(1)
  expect(images.classifications[0].complete).toBe(true)
  expect(decodes).toBe(1)
  const review = await repository.query({
    ...base,
    category: 'image',
    onlyReview: true
  })
  expect(review.rows[0].index).toBe(1)
  expect(review.totalHits).toBe(1)
  expect(
    (await repository.query({ ...base, category: 'image', page: 2 })).rows[0]
      .index
  ).toBe(1)
  expect(
    (await repository.query({ ...base, category: 'residual' })).totalHits
  ).toBe(1)
  expect(
    (
      await repository.query({
        ...base,
        category: 'image',
        onlyReview: true,
        excludeBots: true
      })
    ).totalHits
  ).toBe(0)
  const searched = await repository.query({
    ...base,
    category: 'image',
    search: 'accepted'
  })
  expect(searched.totalHits).toBe(1)
  expect(searched.classificationCounts.all.total).toBe(1)
})
