import { expect, test } from 'bun:test'

import { differenceFilters } from '../protocol/report.ts'
import { fixtureLinkedImage, fixtureRows } from '../testing/fixtures.ts'
import { differenceFilterMask } from './filter.ts'

const origin = 'https://q.example.test'
const file = origin + '/files/00000000-0000-0000-0000-000000000001'
const quote = origin + '/messages/00000000-0000-0000-0000-000000000002'
const anchor = (url: string, label = url) =>
  `<a href="${url}" target="_blank" rel="nofollow noopener noreferrer">${label}</a>`
const filtered = (
  source: string,
  before: string,
  after: string,
  kind: 'html' | 'text' = 'html',
  profile: 'render' | 'inline' | 'plainText' = 'render'
) =>
  Boolean(
    differenceFilterMask(
      {
        source,
        profile,
        before: { kind, value: before },
        after: { kind, value: after }
      },
      origin
    ) & differenceFilters.linkPolicy
  )

test('link policy recognizes bare URL and email delinking, and forced angle domains', () => {
  for (const [source, before, after] of [
    ['trap.jp', anchor('http://trap.jp', 'trap.jp'), 'trap.jp'],
    [
      'https://trap.jp/a?x=1',
      anchor('https://trap.jp/a?x=1'),
      'https://trap.jp/a?x=1'
    ],
    ['//trap.jp', anchor('//trap.jp'), '//trap.jp'],
    [
      'info@trap.jp',
      anchor('mailto:info@trap.jp', 'info@trap.jp'),
      'info@trap.jp'
    ],
    [
      '<trap.jp>',
      '&lt;' + anchor('http://trap.jp', 'trap.jp') + '&gt;',
      anchor('https://trap.jp', 'trap.jp')
    ],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('https://readme.md', 'README.md')
    ],
    [
      '<//trap.jp>',
      '&lt;' + anchor('//trap.jp') + '&gt;',
      anchor('https://trap.jp', '//trap.jp')
    ]
  ])
    expect(filtered(source, before, after), source).toBe(true)
  expect(
    filtered('<README.md>', '<README.md>', 'README.md', 'text', 'plainText')
  ).toBe(true)
  expect(
    filtered('http://x/%00', 'http://x/\0', 'http://x/%00', 'text', 'plainText')
  ).toBe(true)
})

test('resource labels and omitted trailing resource links use the configured origin', () => {
  expect(
    filtered(
      `${file} ${quote}`,
      '[添付ファイル] [引用メッセージ]',
      `${file} ${quote}`,
      'text',
      'plainText'
    )
  ).toBe(true)
  expect(
    filtered(
      `本文 ${file} 続き`,
      '本文 ' + anchor(file, '[[添付ファイル]]') + ' 続き',
      `本文 ${file} 続き`
    )
  ).toBe(true)
  for (const url of [file, quote]) {
    expect(
      filtered(`本文\n${url}`, '<p>本文</p>\n', `<p>本文<br>\n${url}</p>\n`)
    ).toBe(true)
    expect(
      filtered(`本文 ${url}`, '<p>本文 </p>\n', `<p>本文 ${url}</p>\n`)
    ).toBe(true)
    expect(
      filtered(
        `本文  \n${url}`,
        '<p>本文<br>\n</p>\n',
        `<p>本文<br>\n${url}</p>\n`
      )
    ).toBe(true)
    expect(
      filtered(`本文\n${url}`, '本文', `本文 ${url}`, 'html', 'inline')
    ).toBe(true)
    expect(filtered(url, '', `<p>${url}</p>\n`)).toBe(true)
  }
  expect(
    filtered(
      `本文\n${file}\n${quote}`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}<br>\n${quote}</p>\n`
    )
  ).toBe(true)
  const external = file.replace(origin, 'https://external.test')
  expect(
    filtered(
      `本文 ${file} ${quote}`,
      `<p>本文 ${anchor(file)} </p>\n`,
      `<p>本文 ${file} ${quote}</p>\n`
    )
  ).toBe(true)
  expect(
    filtered(
      `本文\n${file}\n\n\n`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}</p>\n<br>\n`
    )
  ).toBe(true)
  expect(
    filtered(
      `本文\n${file}`,
      '<p>本文</p>\n',
      `<p>本文<br>\n${file}</p>\n<br>\n`
    )
  ).toBe(false)
  expect(filtered(external, '', `<p>${external}</p>\n`)).toBe(false)
})

test('link policy retains explicit links, unrelated changes, opaque contexts and regressions', () => {
  for (const [source, before, after] of [
    [
      '[https://trap.jp](https://trap.jp)',
      anchor('https://trap.jp'),
      'https://trap.jp'
    ],
    ['<https://trap.jp>', anchor('https://trap.jp'), 'https://trap.jp'],
    [
      '<info@trap.jp>',
      anchor('mailto:info@trap.jp', 'info@trap.jp'),
      'info@trap.jp'
    ],
    [
      '`https://trap.jp`',
      '<code>' + anchor('https://trap.jp') + '</code>',
      '<code>https://trap.jp</code>'
    ],
    [
      'https://trap.jp',
      anchor('https://other.test', 'https://trap.jp'),
      'https://trap.jp'
    ],
    ['https://trap.jp', anchor('https://trap.jp', 'other'), 'https://trap.jp'],
    ['hello', anchor('http://hello', 'hello'), 'hello'],
    [
      `!{"type":"file","raw":"${file}"}`,
      anchor(file, '[[添付ファイル]]'),
      file
    ],
    [
      'https://trap.jp',
      '<a href="https://trap.jp" title="unexpected">https://trap.jp</a>',
      'https://trap.jp'
    ],
    [
      'https://trap.jp',
      anchor('https://trap.jp') + ' before',
      'https://trap.jp after'
    ],
    ['https://trap.jp', 'https://trap.jp', anchor('https://trap.jp')],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('http://readme.md', 'README.md')
    ],
    [
      '<README.md> <README.md>',
      '&lt;README.md&gt; &lt;README.md&gt;',
      anchor('https://readme.md', 'README.md') + ' &lt;README.md&gt;'
    ],
    [
      '<README.md>',
      '&lt;README.md&gt;',
      anchor('https://other.test', 'README.md')
    ]
  ])
    expect(filtered(source, before, after), source).toBe(false)
  for (const kind of ['error', 'text'] as const)
    expect(
      differenceFilterMask({
        ...fixtureRows[0],
        source: 'https://trap.jp',
        before: { kind: 'html', value: anchor('https://trap.jp') },
        after: { kind, value: 'https://trap.jp' }
      }) & differenceFilters.linkPolicy
    ).toBe(0n)
})

test('all 63 output filter combinations preserve every independently selected difference', () => {
  const url = 'https://bare.example'
  const after = `<a href="https://example.test/docs" title="page">!badge's</a>`
  const error = (value: string) =>
    `<span class="katex-error" title="${value}">${value}</span>`
  for (let required = 1; required < 64; required++) {
    let label = required & 2 ? "BADGE'S" : "badge's"
    if (required & 1) label = label.slice(0, 2) + ' ' + label.slice(2)
    if (required & 8) label = label.replace(/'/g, '&#039;')
    const opening =
      required & 8
        ? `<a title='page' href='https://example.test/docs'>`
        : '<a href="https://example.test/docs" title="page">'
    const image =
      required & 4
        ? `[!<a href="https://images.example.test/badge.svg">${label}</a>](${opening}https://example.test/docs</a>)`
        : `${opening}!${label}</a>`
    const mask = differenceFilterMask({
      source: url + ' ' + fixtureLinkedImage.source,
      before: {
        kind: 'html',
        value:
          (required & 32 ? anchor(url) : url) +
          image +
          error(required & 16 ? 'before' : 'after')
      },
      after: { kind: 'html', value: url + after + error('after') }
    })
    for (let selected = 1; selected < 64; selected++)
      expect(
        Boolean(mask & (1n << BigInt(selected - 1))),
        `required ${required}, selected ${selected}`
      ).toBe((required & selected) === required)
  }
})
