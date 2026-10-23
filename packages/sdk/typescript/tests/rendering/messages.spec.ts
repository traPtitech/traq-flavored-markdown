import { withDefaultAdapters } from '@traq-flavored-markdown/sdk/adapters'
import {
  endsWithResourceCard,
  messageRenderers,
  resourceCardFromUrl
} from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import linkFixtures from '../../../tests/fixtures/traq-links.json' with { type: 'json' }
import { classifyTraqLink } from '../../src/traq/messages/cards.js'
import { commonParser, parser } from './setup.js'

const origin = 'https://q.example.test',
  fileId = '00000000-0000-0000-0000-000000000001',
  messageId = '00000000-0000-0000-0000-000000000002'

const file = origin + '/files/' + fileId,
  quote = origin + '/messages/' + messageId
const view = messageRenderers({ origin, ...withDefaultAdapters() })

test('message renderers keep telephone links and show rejected autolinks with brackets', () => {
  for (const renderer of [view.standard, view.condensed]) {
    expect(
      renderer.render(parser.parse('[090-1234-5678](tel:+819012345678)')).html
    ).toContain('href="tel:+819012345678"')
    expect(renderer.render(parser.parse('<hoge:hoge>')).html).toContain(
      '&lt;hoge:hoge&gt;'
    )
    expect(renderer.render(parser.parse('a <em>b</em>')).html).toContain(
      'a &lt;em&gt;b&lt;/em&gt;'
    )
  }
})

test('URL meaning follows the shared Rust contract', () => {
  for (const fixture of linkFixtures) {
    expect(fixture.target, fixture.name).toEqual(
      classifyTraqLink(fixture.url, fixture.origin) ?? null
    )
  }
  const uppercase = origin + '/files/ABCDEF00-0000-0000-0000-000000000001'
  expect(resourceCardFromUrl(uppercase, origin)).toEqual({
    type: 'file',
    id: 'abcdef00-0000-0000-0000-000000000001'
  })
  expect(resourceCardFromUrl(file + '/extra', origin)).toBeUndefined()
  expect(resourceCardFromUrl(file + '/', origin)).toBeUndefined()
  expect(view.standard.render(parser.parse(file + '/extra')).html).toContain(
    file + '/extra'
  )
})

test('message rendering extracts cards, trims trailing bare links, and keeps the AST reusable', () => {
  const source = '本文\n' + file + '\n' + quote,
    document = parser.parse(source),
    snapshot = document.toMutable()
  expect(Object.keys(view).sort()).toEqual([
    'condensed',
    'prepare',
    'render',
    'standard'
  ])
  for (const renderer of [view.standard, view.condensed])
    expect(Object.keys(renderer)).toEqual(['render'])
  const normal = view.standard.render(document),
    condensed = view.condensed.render(document)
  expect(normal.html).toBe('<p>本文</p>\n')
  expect(condensed.html).toBe('本文')
  expect(normal.rawText).toBe(source)
  expect(normal.cards).toEqual([
    { type: 'file', id: fileId },
    { type: 'message', id: messageId }
  ])
  expect(condensed.cards).toEqual(normal.cards)
  expect(document.document).toEqual(snapshot)
  expect(view.standard.render(document).html).toBe(normal.html)
  expect(
    view.standard
      .render(parser.parse(file + '\n\n' + quote))
      .html.includes(file)
  ).toBe(true)
})

test('card extraction respects Markdown context and preserves external URL candidates', () => {
  const source =
    file +
    ' mid ' +
    file +
    '\n[quoted](' +
    quote +
    ')\n!!' +
    quote +
    '!!\n`' +
    quote +
    '`\nhttps://example.com\nhttps://example.com'
  expect(view.standard.render(parser.parse(source)).cards).toEqual([
    { type: 'file', id: fileId },
    { type: 'message', id: messageId },
    { type: 'url', url: 'https://example.com' },
    { type: 'url', url: 'https://example.com' }
  ])
  for (const source of [
    '!!' + file + '!!',
    '`' + file + '`',
    '```\n' + file + '\n```'
  ])
    expect(view.standard.render(parser.parse(source)).cards).toEqual([])
  expect(resourceCardFromUrl(origin + '/channels/test', origin)).toBeUndefined()
  expect(
    resourceCardFromUrl(origin + '/channels/test', origin + '/')
  ).toBeUndefined()
  expect(resourceCardFromUrl(origin + '/files/invalid', origin)).toBeUndefined()
  expect(resourceCardFromUrl('javascript:alert(1)', origin)).toBeUndefined()
  expect(resourceCardFromUrl('/files/' + fileId, origin)).toBeUndefined()
  expect(resourceCardFromUrl(file + '?download=1', origin)).toEqual({
    type: 'file',
    id: fileId
  })
  expect(
    resourceCardFromUrl('https://other.test/files/' + fileId, origin)
  ).toEqual({ type: 'url', url: 'https://other.test/files/' + fileId })
  for (const value of [
    'https://Q.EXAMPLE.TEST/files/' + fileId,
    'https://q.example.test:443/files/' + fileId
  ]) {
    expect(resourceCardFromUrl(value, origin)).toEqual({
      type: 'url',
      url: value
    })
  }
  expect(
    messageRenderers({ origin: origin + '///' }).standard.render(
      parser.parse(file)
    ).cards
  ).toEqual([{ type: 'file', id: fileId }])
})

test('condensed labels retained card links without removing explicit labels from message content', () => {
  const document = parser.parse('[資料](' + file + ') ' + quote + ' 続き')
  expect(view.standard.render(document).html).toMatch(/>資料<\/a>/)
  const text = view.condensed.render(document).html
  expect(text).toMatch(/>\[\[添付ファイル\]\]<\/a>/)
  expect(text).toMatch(/>\[\[引用メッセージ\]\]<\/a> 続き/)
  expect(view.condensed.render(parser.parse(file)).html).toBe('')
  expect(view.standard.render(parser.parse('<' + file + '>')).html).toMatch(
    /<a /
  )
})

test('condensed preserves explicit quote links and their labels', () => {
  for (const source of [
    '[AAA](' + quote + ')',
    '[**AAA**](' + quote + ')',
    '[AAA][quote]\n\n[quote]: ' + quote,
    '<' + quote + '>'
  ]) {
    const document = parser.parse(source),
      result = view.condensed.render(document)
    expect(result.html).toMatch(/<a /)
    expect(result.html).not.toMatch(/\[\[引用メッセージ\]\]/)
    expect(result.html).toBe(
      view.standard.render(document).html.trim().slice(3, -4)
    )
    expect(result.cards).toEqual([{ type: 'message', id: messageId }])
  }
})

test('traQ condensed flattens full-document block structure and break nodes', () => {
  expect(
    view.condensed.render({
      source: '<unknown>',
      children: [{ kind: 'custom', span: { start: 0, end: 9 }, data: {} }]
    }).html
  ).toBe('&lt;unknown&gt;')
  for (const [source, expected] of [
    ['a\nb', 'a b'],
    ['a  \nb', 'a b'],
    ['a\n\nb', 'a b'],
    ['# heading\n\ntext', '# heading text'],
    ['- one\n- two', '- one - two'],
    ['> quote\n> next', '> quote next'],
    ['| a | b |\n| - | - |\n| c | d |', '| a | b | | c | d |'],
    ['```\na\nb\n```', '<code>a\nb\n</code>']
  ])
    expect(view.condensed.render(parser.parse(source)).html).toBe(expected)
  expect(view.standard.render(parser.parse('a\nb')).html).toMatch(/<br>/)
  expect(view.condensed.render(parser.parse('a\n\n\n\nb')).html).not.toMatch(
    /<br>/
  )
})

test('condensed numbers ordered list items from the list start', () => {
  for (const [source, expected] of [
    ['1. one\n1. two\n1. three', '1. one 2. two 3. three'],
    ['4) four\n4) five', '4) four 5) five'],
    [
      '1. outer\n   1. inner\n   1. next\n1. last',
      '1. outer 1. inner 2. next 2. last'
    ]
  ])
    expect(view.condensed.render(parser.parse(source)).html).toBe(expected)
})

test('condensed renders images as links and restricts math size commands', () => {
  const images = commonParser()
  expect(
    view.condensed.render(images.parse('![alt](https://example.test/a.png)'))
      .html
  ).toBe('<a href="https://example.test/a.png" data-is-image>alt</a>')
  expect(view.condensed.render(parser.parse('$\\Huge x$')).html).not.toMatch(
    /size11|katex-display/
  )
  expect(view.condensed.render(parser.parse('$$x$$')).html).not.toMatch(
    /katex-block|katex-display/
  )
  expect(view.standard.render(parser.parse('$$x$$')).html).toMatch(
    /katex-block/
  )
})

test('attachment spacing checks the complete AST instead of its final source line', () => {
  expect(endsWithResourceCard(parser.parse('本文\n' + file), origin)).toBe(true)
  expect(endsWithResourceCard(parser.parse('本文 ' + file), origin)).toBe(false)
  expect(endsWithResourceCard(parser.parse('~~~\n' + file), origin)).toBe(false)
  expect(endsWithResourceCard(parser.parse('!!' + file + '!!'), origin)).toBe(
    false
  )
  expect(
    endsWithResourceCard(parser.parse('[' + file + '](' + file + ')'), origin)
  ).toBe(false)
})

test('a card link attached to text remains in the rendered message', () => {
  const document = parser.parse('本文 ' + file)
  expect(endsWithResourceCard(document, origin)).toBe(false)
  expect(view.standard.render(document).html).toContain(file)
  expect(view.condensed.render(document).html).toContain('[[添付ファイル]]')
})
