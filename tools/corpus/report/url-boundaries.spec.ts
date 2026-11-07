import { expect, test } from 'bun:test'
import { escapeAttribute, escapeText } from 'entities'

import { differenceFilters } from '../protocol/report.ts'
import { differenceFilterMask } from './filter.ts'
import { expectedBareUrl } from './url-boundaries.ts'

const anchor = (href: string, label = href) =>
  `<a href="${escapeAttribute(href)}" target="_blank" rel="nofollow noopener noreferrer">${escapeText(label)}</a>`

const filtered = (source: string, before: string, after: string) =>
  Boolean(
    differenceFilterMask({
      source,
      profile: 'render',
      before: { kind: 'html', value: before },
      after: { kind: 'html', value: after }
    }) & differenceFilters.linkPolicy
  )

const url = 'https://example.test/a'

test('link-policy filtering verifies the current boundary and preserves required link counts', () => {
  for (const [source, before, after] of [
    [url + ':', anchor(url + ':'), anchor(url) + ':'],
    [url + '~', anchor(url + '~'), anchor(url) + '~'],
    [url + '?!.,:*~~;', anchor(url + '?!.,:*~~;'), anchor(url) + '?!.,:*~~;'],
    [url + '_', anchor(url) + '_', anchor(url + '_')],
    [url + '-', anchor(url) + '-', anchor(url + '-')],
    [
      `hoge(${url}(b))fuga`,
      'hoge(' + anchor(url + '(b))fuga'),
      'hoge(' + anchor(url + '(b)') + ')fuga'
    ],
    [url + '(b', anchor(url + '(b'), anchor(url) + '(b'],
    ['[' + url + ']', '[' + anchor(url) + ']', '[' + url + ']'],
    [
      'http://localhost:8080とか',
      'http://localhost:8080とか',
      anchor('http://localhost:8080') + 'とか'
    ],
    [
      '//localhost.test:3000とか',
      '//localhost.test:3000とか',
      anchor('https://localhost.test:3000', '//localhost.test:3000') + 'とか'
    ]
  ]) {
    expect(filtered(source, before, after), source).toBe(true)
  }

  for (const [source, before, after] of [
    [url + '(b)', anchor(url + '(b)'), anchor(url) + '(b)'],
    [url + '(b)', url + '(b)', anchor(url) + '(b)'],
    [
      'http://localhost:8080abc',
      'http://localhost:8080abc',
      anchor('http://localhost:8080') + 'abc'
    ],
    [url + ':', anchor(url + ':'), anchor('https://wrong.test', url) + ':'],
    [url + ':', anchor(url + ':'), url + ':'],
    [url + ':', anchor(url + ':'), anchor(url) + ': extra'],
    ['[' + url + ']', '[' + url + ']', '[' + anchor(url) + ']'],
    [
      url + ': ' + url + ':',
      anchor(url + ':') + ' ' + anchor(url + ':'),
      anchor(url) + ': ' + url + ':'
    ],
    [
      '`' + url + '` ' + url + '(b)',
      '<code>' + url + '</code> ' + url + '(b)',
      '<code>' + url + '</code> ' + anchor(url) + '(b)'
    ]
  ]) {
    expect(filtered(source, before, after), source).toBe(false)
  }
})

test('source-backed URL formatting composes with boundary changes and keeps unrelated markup changes', () => {
  expect(
    filtered(
      '~~' + url + '~~',
      '~~' + anchor(url + '~~'),
      '<s>' + anchor(url) + '</s>'
    )
  ).toBe(true)

  const raw = 'https://example.test/%E6%97%A5'
  const label = 'https://example.test/日'

  expect(
    filtered(
      '~~' + raw + '~~',
      '~~' + anchor(raw + '~~', label + '~~'),
      '<s>' + anchor(raw, label) + '</s>'
    )
  ).toBe(true)

  expect(
    filtered(
      raw + '~',
      anchor(raw + '~', label + '~'),
      anchor(raw, label) + '~'
    )
  ).toBe(true)

  const formatted = 'https://example.test/__name__'

  expect(
    filtered(
      '[' + formatted + ']',
      '[' + anchor(formatted) + ']',
      '[https://example.test/<strong>name</strong>]'
    )
  ).toBe(true)

  expect(
    filtered(
      '~~' + url + '~~',
      '~~' + anchor(url + '~~'),
      '<s class="changed">' + anchor(url) + '</s>'
    )
  ).toBe(false)

  expect(
    filtered(
      '~~' + url + '~~',
      '<p title="a" title="b">~~' + anchor(url + '~~') + '</p>',
      '<p title="a" title="b"><s>' + anchor(url) + '</s></p>'
    )
  ).toBe(false)

  expect(
    filtered(
      '~~' + url + '~~',
      '~~' + anchor(url + '~~'),
      '<s>' + anchor(url) + '</s><br>'
    )
  ).toBe(false)

  expect(
    filtered(
      '`~~' + url + '~~`',
      '<code>~~' + anchor(url + '~~') + '</code>',
      '<code><s>' + anchor(url) + '</s></code>'
    )
  ).toBe(false)

  expect(
    filtered(
      '[label](' + url + '~)',
      anchor(url + '~', 'label'),
      anchor(url, 'label') + '~'
    )
  ).toBe(false)

  expect(
    filtered(
      url + ': ~~https://other.test~~',
      anchor(url + ':') + ' ~~https://other.test~~',
      anchor(url) + ': <s>https://other.test</s>'
    )
  ).toBe(false)
})

test('the boundary verifier handles nested parentheses and long punctuation without unbounded rescans', () => {
  for (const [input, expected] of [
    [url + '(b(c))', url + '(b(c))'],
    [url + '(b(c)', url],
    [url + '(b)c(d', url + '(b)c'],
    [url + ')b(c)', url],
    [url + '([b])', url + '([b])'],
    [url + '([b)]', url],
    [url + '~user/_', url + '~user/_'],
    [url + ';'.repeat(20_000), url]
  ]) {
    expect(expectedBareUrl(input, input), input.slice(0, 80)).toBe(expected)
  }

  expect(expectedBareUrl(url + ' ' + url + '(b)', url)).toBeNull()
})
