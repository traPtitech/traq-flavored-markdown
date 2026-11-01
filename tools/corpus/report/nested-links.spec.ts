import { expect, test } from 'bun:test'

import { differenceFilters } from '../protocol/report.ts'
import { fixtureNestedLink } from '../testing/fixtures.ts'
import { differenceFilterMask } from './filter.ts'
import { normalizeNestedLinks } from './nested-links.ts'

const html = (value: string) => ({ kind: 'html' as const, value })
const hidden = (before: string, after: string, source?: string) =>
  Boolean(
    differenceFilterMask({ before: html(before), after: html(after), source }) &
    differenceFilters.nestedLinks
  )

test('empty outer destinations and unrelated empty links remain eligible for nested-link exclusion', () => {
  for (const href of ['', '/outer']) {
    const before = `<a href="${href}"><strong><a href="/inner">label</a></strong></a><a href="">other</a>`
    const after = `<a href="${href}"><strong>label</strong></a><a href="">other</a>`
    expect(hidden(before, after)).toBe(true)
    expect(hidden(before, after.replace('>label<', '>changed<'))).toBe(false)
  }
  expect(hidden('<a><a href="/inner">label</a></a>', '<a>label</a>')).toBe(
    false
  )
})

test('nested-link filtering accepts the outer destination, preserves rich labels, and is independent of existing options', () => {
  const { before, after } = fixtureNestedLink
  const mask = differenceFilterMask(fixtureNestedLink)
  expect(mask & differenceFilters.nestedLinks).toBeTruthy()
  expect(mask & ((1n << 63n) - 1n)).toBe(0n)
  for (const [left, right] of [
    [before.value, after.value],
    [after.value, before.value],
    [
      '<a href="/outer"><em>a <a href="/inner"><code>b</code></a> c</em></a>',
      '<a href="/outer"><em>a <code>b</code> c</em></a>'
    ],
    [
      '<a href="/outer"><a href="/a">a</a> <strong><a href="/b">b</a></strong></a>',
      '<a href="/outer">a <strong>b</strong></a>'
    ],
    [
      '<a href="/outer"><a href="/middle"><a href="/inner">a</a></a></a>',
      '<a href="/outer">a</a>'
    ],
    [
      '<a href="/outer"><a title="quoted > tag" href="/inner">a &amp; b</a></a>',
      '<a href="/outer">a &amp; b</a>'
    ],
    [before.value + before.value, after.value + after.value]
  ])
    expect(hidden(left, right)).toBe(true)
})

test('nested-link filtering retains outer destinations, attributes, label formatting, other text and malformed HTML', () => {
  const { before, after } = fixtureNestedLink
  for (const changed of [
    after.value.replace('/event/test', '/event/other'),
    after.value.replace('target="_blank"', 'target="_self"'),
    after.value.replace('#event/test', '#event/renamed'),
    after.value.replace('#event/test', '<strong>#event/test</strong>'),
    after.value + '<p>extra</p>',
    after.value.replace('</a>', ''),
    after.value.replace('<a ', '<span ').replace('</a>', '</span>')
  ])
    expect(hidden(before.value, changed, fixtureNestedLink.source)).toBe(false)
  for (const prefix of [
    '<script>"<a href=/x>"</script>',
    '<svg></svg>',
    '<p title="a" title="b">x</p>'
  ])
    expect(hidden(prefix + before.value, prefix + after.value)).toBe(false)
  for (const wrap of [
    (value: string) => '<code>' + value + '</code>',
    (value: string) => '<pre>' + value + '</pre>',
    (value: string) => '<template>' + value + '</template>',
    (value: string) => '<!--' + value + '-->'
  ])
    expect(hidden(wrap(before.value), wrap(after.value))).toBe(false)
  expect(
    hidden(
      '<a href="/outer"><a href="/inner">label</a>',
      '<a href="/outer">label</a>'
    )
  ).toBe(false)
  expect(
    hidden(
      '<a href="/first">a</a><a href="/second">b</a>',
      '<a href="/first">ab</a>'
    )
  ).toBe(false)
  expect(
    hidden(before.value, before.value.replace('#c-channel-id', '#c-other-id'))
  ).toBe(false)
  for (const kind of ['text', 'error'] as const)
    expect(
      differenceFilterMask({
        before: { kind, value: before.value },
        after: { kind, value: after.value }
      })
    ).toBe(0n)
  expect(
    differenceFilterMask({ before, after: { ...after, kind: 'text' } })
  ).toBe(0n)
})

test('historical raw reference labels require the same source, reference ID, label and outer URL', () => {
  const { before, after, source } = fixtureNestedLink
  const literal = '!{"type":"channel","raw":"#event/test","id":"channel-id"}'
  const raw = after.value.replace(
    '#event/test</a>',
    literal.replaceAll('"', '&quot;') + '</a>'
  )
  expect(hidden(before.value, raw, source)).toBe(true)
  expect(hidden(before.value + before.value, raw + raw, source)).toBe(true)
  expect(hidden(raw, before.value, source)).toBe(true)
  expect(hidden(before.value, raw)).toBe(false)
  expect(
    hidden(before.value, raw, source.replace('channel-id', 'other-id'))
  ).toBe(false)
  expect(
    hidden(before.value.replace('#c-channel-id', '#c-other-id'), raw, source)
  ).toBe(false)
  expect(
    hidden(
      before.value.replace('>#event/test<', '>#event/renamed<'),
      raw,
      source
    )
  ).toBe(false)
  expect(
    hidden(
      before.value,
      raw.replace('/channels/event/test', '/channels/other'),
      source
    )
  ).toBe(false)
  expect(
    hidden(before.value, raw.replace('channel-id', 'other-id'), source)
  ).toBe(false)
  expect(hidden(before.value, raw.replace('!{', 'prefix !{'), source)).toBe(
    false
  )
  // Literal JSON in unrelated text is never projected.
  expect(
    hidden(before.value + literal, after.value + '#event/test', source)
  ).toBe(false)
  // A second anchor to the same outer URL is a separate occurrence.
  expect(hidden(before.value + raw, after.value + after.value, source)).toBe(
    false
  )
  expect(
    normalizeNestedLinks({
      before: html(literal),
      after: html('#event/test'),
      source
    })
  ).toBeUndefined()
})

test('all 127 filter combinations hide exactly the selected independent changes', () => {
  const error = (value: string) =>
    `<span class="katex-error" title="${value}">${value}</span>`
  for (let required = 1; required < 128; required++) {
    let label = required & 2 ? "BADGE'S" : "badge's"
    if (required & 1) label = label.slice(0, 2) + ' ' + label.slice(2)
    if (required & 8) label = label.replace("'", '&#039;')
    const opening =
      required & 8
        ? "<a title='page' href='https://example.test/docs'>"
        : '<a href="https://example.test/docs" title="page">'
    const image =
      required & 4
        ? `[!<a href="https://images.example.test/badge.svg">${label}</a>](${opening}https://example.test/docs</a>)`
        : `${opening}!${label}</a>`
    const mask = differenceFilterMask({
      source: 'bare.example',
      before: html(
        (required & 32
          ? '<a href="http://bare.example">bare.example</a>'
          : 'bare.example') +
          image +
          error(required & 16 ? 'before' : 'after') +
          (required & 64
            ? fixtureNestedLink.before.value
            : fixtureNestedLink.after.value)
      ),
      after: html(
        'bare.example<a href="https://example.test/docs" title="page">!badge\'s</a>' +
          error('after') +
          fixtureNestedLink.after.value
      )
    })
    for (let selected = 1; selected < 128; selected++)
      expect(
        Boolean(mask & (1n << BigInt(selected - 1))),
        `required ${required}, selected ${selected}`
      ).toBe((required & selected) === required)
  }
})
