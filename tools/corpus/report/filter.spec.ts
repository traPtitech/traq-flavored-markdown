import { expect, test } from 'bun:test'

import { differenceFilters } from '../protocol/report.ts'
import {
  fixtureHtmlSerialization,
  fixtureLinkedImage,
  fixtureRows
} from '../testing/fixtures.ts'
import { differenceFilterMask } from './filter.ts'

test('output filters distinguish whitespace, letter case, and their combination', () => {
  for (const kind of ['html', 'text'] as const)
    for (const [before, after, expected] of [
      ['alpha \t\r\n\f', 'alpha', [true, false, true]],
      ['Alpha', 'alpha', [false, true, true]],
      ['A b', 'ab', [false, false, true]],
      ['ÄΩ', 'äω', [false, true, true]],
      ['a\u00a0', 'A', [false, false, false]],
      ['before', 'after', [false, false, false]]
    ] as const) {
      const mask = differenceFilterMask({
        before: { kind, value: before },
        after: { kind, value: after }
      })
      expect(
        [
          differenceFilters.whitespace,
          differenceFilters.case,
          differenceFilters.whitespaceAndCase
        ].map(filter => Boolean(mask & filter))
      ).toEqual([...expected])
    }
})

test('linked-image filters compose with whitespace and case without hiding other HTML changes', () => {
  const before = fixtureLinkedImage.before.value
  const after = fixtureLinkedImage.after.value
  for (const [left, right, expected] of [
    [before, after, [true, true, true, true]],
    [after, before, [true, true, true, true]],
    [before + ' ', after, [false, true, false, true]],
    [before.replace('>badge<', '>BADGE<'), after, [false, false, true, true]],
    [before.replace('>badge<', '>BAD GE<'), after, [false, false, false, true]],
    [before + before, after + after, [true, true, true, true]],
    [before, after + '<p>new text</p>', [false, false, false, false]],
    [before, after.replace('/docs', '/other'), [false, false, false, false]],
    [before, after.replace('!badge', '!other'), [false, false, false, false]],
    [
      before,
      after.replace('>!', ' title="new">!'),
      [false, false, false, false]
    ],
    [
      before.replace('>badge<', '><a href="/user">badge</a><'),
      after,
      [false, false, false, false]
    ]
  ] as const) {
    const mask = differenceFilterMask({
      before: { kind: 'html', value: left },
      after: { kind: 'html', value: right }
    })
    expect(
      [
        differenceFilters.linkedImages,
        differenceFilters.whitespaceAndLinkedImages,
        differenceFilters.caseAndLinkedImages,
        differenceFilters.whitespaceAndCaseAndLinkedImages
      ].map(filter => Boolean(mask & filter))
    ).toEqual([...expected])
  }
})

test('linked-image filtering preserves attributes and multiline alt HTML', () => {
  const outer =
    '<a href="https://example.test/page?a=1&amp;b=2" title="page &quot;title&quot;" target="_blank">'
  const label = '<em>badge</em>\n&amp; more'
  expect(
    differenceFilterMask({
      before: {
        kind: 'html',
        value: `[!<a href="https://images.example.test/a.svg" title="image">${label}</a>](${outer}https://example.test/page?a=1&amp;b=2</a>)`
      },
      after: { kind: 'html', value: `${outer}!${label}</a>` }
    }) & differenceFilters.linkedImages
  ).toBeTruthy()
})

test('image-like text, errors and kind changes are never hidden by the image filter', () => {
  const { before, after } = fixtureLinkedImage
  for (const kind of ['text', 'error'] as const)
    expect(
      differenceFilterMask({
        before: { kind, value: before.value },
        after: { kind, value: after.value }
      }) & differenceFilters.linkedImages
    ).toBe(0n)
  for (const kind of ['text', 'error'] as const)
    expect(differenceFilterMask({ before, after: { ...after, kind } })).toBe(0n)
})

test('output filters never hide errors or changes of output kind', () => {
  expect(differenceFilterMask(fixtureRows[1])).toBe(0n)
  expect(
    differenceFilterMask({
      before: { kind: 'html', value: 'SAME ' },
      after: { kind: 'text', value: 'same' }
    })
  ).toBe(0n)
  expect(
    differenceFilterMask({
      before: { kind: 'error', value: 'Error ' },
      after: { kind: 'error', value: 'error' }
    })
  ).toBe(0n)
})

test('all 31 filter combinations ignore exactly their selected differences', () => {
  const after = `<a href="https://example.test/docs" title="page">!badge's</a>`
  const error = (value: string) =>
    `<span class="katex-error" title="${value}">${value}</span>`
  for (let required = 1; required < 32; required++) {
    let label = required & 2 ? "BADGE'S" : "badge's"
    if (required & 1) label = label.slice(0, 2) + ' ' + label.slice(2)
    if (required & 8) label = label.replace("'", '&#039;')
    const opening =
      required & 8
        ? `<a title='page' href='https://example.test/docs'>`
        : '<a href="https://example.test/docs" title="page">'
    const before =
      required & 4
        ? `[!<a href="https://images.example.test/badge.svg">${label}</a>](${opening}https://example.test/docs</a>)`
        : `${opening}!${label}</a>`
    const mask = differenceFilterMask({
      before: {
        kind: 'html',
        value: before + error(required & 16 ? 'bad-before' : 'bad-after')
      },
      after: { kind: 'html', value: after + error('bad-after') }
    })
    for (let selected = 1; selected < 32; selected++)
      expect(Boolean(mask & (1n << BigInt(selected - 1)))).toBe(
        (required & selected) === required
      )
  }
})

test('HTML spelling filtering preserves substantive changes, non-HTML text and failures', () => {
  const { before, after } = fixtureHtmlSerialization
  for (const changed of [
    after.value.replace("a'b</span>", "a'c</span>"),
    after.value.replace('class="error"', 'class="other"'),
    after.value + '<br>',
    after.value.replace("a'b</span>", "a' b</span>")
  ])
    expect(
      differenceFilterMask({
        before,
        after: { kind: 'html', value: changed }
      }) & differenceFilters.htmlSerialization
    ).toBe(0n)
  for (const kind of ['text', 'error'] as const) {
    expect(
      differenceFilterMask({
        before: { kind, value: before.value },
        after: { kind, value: after.value }
      }) & differenceFilters.htmlSerialization
    ).toBe(0n)
    expect(
      differenceFilterMask({ before, after: { kind, value: after.value } })
    ).toBe(0n)
  }
})

test('adding HTML or image filtering cannot reveal an already excluded difference', () => {
  const malformed = '<span title="x" title="y">A b</span>'
  const whitespaceCase = differenceFilterMask({
    before: { kind: 'html', value: malformed },
    after: { kind: 'html', value: malformed.replace('A b', 'ab') }
  })
  expect(whitespaceCase & differenceFilters.htmlSerialization).toBe(0n)
  expect(
    whitespaceCase & differenceFilters.whitespaceAndCaseAndHtmlSerialization
  ).toBeTruthy()
  const spelling = differenceFilterMask({
    before: fixtureLinkedImage.before,
    after: {
      kind: 'html',
      value: fixtureLinkedImage.before.value.replace('[', '&#91;')
    }
  })
  expect(spelling & differenceFilters.htmlSerialization).toBeTruthy()
  for (const mask of [whitespaceCase, spelling])
    for (let subset = 1; subset < 32; subset++)
      for (let selected = 1; selected < 32; selected++)
        if ((subset & selected) === subset && mask & (1n << BigInt(subset - 1)))
          expect(mask & (1n << BigInt(selected - 1))).toBeTruthy()
})
