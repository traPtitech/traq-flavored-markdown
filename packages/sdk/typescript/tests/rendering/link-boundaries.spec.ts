import {
  createHtmlRenderer,
  messageRenderers
} from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import { parser } from './setup.js'

test('bare URLs balance parentheses and trim terminal tildes while preserving identifier suffixes', () => {
  const view = createHtmlRenderer()
  for (const [source, destination, formatting] of [
    ['~~https://example.test/a~~', 'https://example.test/a', '<s>'],
    ['~~\\https://example.test/a~~', 'https://example.test/a', '<s>'],
    ['~~<https://example.test/a~~>~~', 'https://example.test/a~~', '<s>'],
    ['[label](https://example.test/a~)', 'https://example.test/a~', 'label'],
    ['https://example.test/a_(b', 'https://example.test/a_', '(b'],
    ['https://example.test/a_(b))', 'https://example.test/a_(b)', ')'],
    ['https://example.test/a_(b))+ok', 'https://example.test/a_(b)', ')+ok'],
    ['word-https://example.test/a', 'https://example.test/a', 'word-'],
    [
      'https://example.test/__name__/end',
      'https://example.test/__name__/end',
      ''
    ],
    ['https://example.test/__name__', 'https://example.test/__name__', '']
  ]) {
    const html = view.render(parser.parseInline(source))
    expect(html, source).toContain(`href="${destination}"`)
    expect(html, source).toContain(formatting)
    expect(html.match(/<a\b/g)?.length, source).toBe(1)
  }
  expect(view.render(parser.parseInline('wordhttps://example.test/a'))).toBe(
    'wordhttps://example.test/a'
  )
  expect(
    view.render(parser.parseInline('[https://example.test/__name__]'))
  ).toBe('[https://example.test/<strong>name</strong>]')
})

test('bare URL boundaries preserve surrounding prose and explicit links retain the complete URL', () => {
  const view = createHtmlRenderer()
  const link = (href: string, label = href) =>
    `<a href="${href}" target="_blank" rel="nofollow noopener noreferrer">${label}</a>`
  for (const [source, expected] of [
    [
      'hogehoge(https://example.test/a)fugafuga',
      'hogehoge(' + link('https://example.test/a') + ')fugafuga'
    ],
    [
      'hogehoge(https://example.test)fugafuga',
      'hogehoge(' + link('https://example.test') + ')fugafuga'
    ],
    [
      'hogehoge(https://example.test/a_(b))fugafuga',
      'hogehoge(' + link('https://example.test/a_(b)') + ')fugafuga'
    ],
    [
      '説明(//example.test/a_(b(c)))続き',
      '説明(' +
        link('https://example.test/a_(b(c))', '//example.test/a_(b(c))') +
        ')続き'
    ],
    [
      'https://en.wikipedia.org/wiki/Function_(mathematics)',
      link('https://en.wikipedia.org/wiki/Function_(mathematics)')
    ],
    [
      'https://ja.wikipedia.org/wiki/関数_(数学)',
      link(
        'https://ja.wikipedia.org/wiki/%E9%96%A2%E6%95%B0_(%E6%95%B0%E5%AD%A6)',
        'https://ja.wikipedia.org/wiki/関数_(数学)'
      )
    ],
    ['https://example.test/a(b(c))', link('https://example.test/a(b(c))')],
    ['https://example.test/a(b)c(d', link('https://example.test/a(b)c') + '(d'],
    ['https://example.test/a(b(c)', link('https://example.test/a') + '(b(c)'],
    ['https://example.test/a)b(c)', link('https://example.test/a') + ')b(c)'],
    [
      '説明(//example.test/a_)続き',
      '説明(' + link('https://example.test/a_', '//example.test/a_') + ')続き'
    ],
    [
      'https://example.test/?id=token_',
      link('https://example.test/?id=token_')
    ],
    ['https://example.test/#token-', link('https://example.test/#token-')],
    [
      'https://example.test/~user/page',
      link('https://example.test/~user/page')
    ],
    ['https://example.test/a_~~', link('https://example.test/a_') + '~~'],
    ['<https://example.test/a(b)~_->', link('https://example.test/a(b)~_-')],
    ['<https://example.test/a(b>', link('https://example.test/a(b')],
    ['<https://example.test/a)b>', link('https://example.test/a)b')],
    [
      '[label](<https://example.test/a(b>)',
      link('https://example.test/a(b', 'label')
    ],
    [
      '<//example.test/a(b)~_->',
      link('https://example.test/a(b)~_-', '//example.test/a(b)~_-')
    ],
    [
      '[label](https://example.test/a_(b))',
      link('https://example.test/a_(b)', 'label')
    ],
    [
      '~~<https://example.test/a~>~~',
      '<s>' + link('https://example.test/a~') + '</s>'
    ],
    [
      '_<https://example.test/a_>_',
      '<em>' + link('https://example.test/a_') + '</em>'
    ],
    ['_https://example.test/a_', '_' + link('https://example.test/a_')]
  ])
    expect(view.render(parser.parseInline(source)), source).toBe(expected)
})

test('fallback image labels retain formatting and resolved references without nested links', () => {
  const image = 'https://example.test/image.png'
  const page = 'https://example.test/page'
  const reference =
    '!{"type":"channel","raw":"#general","id":"00000000-0000-0000-0000-000000000001"}'
  const label =
    '**bold** *em* ~~strike~~ `code` [child](https://child.test) ' + reference
  const views = messageRenderers({
    origin: 'https://q.example.test',
    images: { validate: () => false },
    references: { resolve: () => ({ href: '#channel', label: '#resolved<&' }) }
  })
  for (const source of [
    `![${label}](${image})`,
    `[![${label.replace('[child](https://child.test)', 'child')}](${image})](${page})`
  ]) {
    const document = parser.parse(source)
    const snapshot = document.toMutable()
    for (const renderer of [views.standard, views.condensed]) {
      const html = renderer.render(document).html
      expect(html).toContain('<strong>bold</strong>')
      expect(html).toContain('<em>em</em>')
      expect(html).toContain('<s>strike</s>')
      expect(html).toContain('<code>code</code>')
      expect(html).toContain('#resolved&lt;&amp;')
      expect(html).not.toContain('type')
      expect(html).not.toContain('href="https://child.test"')
      expect(html).not.toContain('href="#channel"')
      expect(html.match(/<a\b/g)?.length).toBe(1)
      expect(html).toContain(`href="${source.startsWith('[!') ? page : image}"`)
    }
    expect(document.document).toEqual(snapshot)
  }
  expect(
    createHtmlRenderer({ images: { validate: () => true } }).render(
      parser.parseInline('![**bold** `code`](https://example.test/image.png)')
    )
  ).toContain('alt="bold code"')
})

test('rejected destinations and empty images retain readable formatted labels', () => {
  const view = createHtmlRenderer({ images: { validate: () => false } })
  for (const destination of [
    'javascript:alert(1)',
    'spotify:track:123',
    'file:///tmp/file'
  ]) {
    expect(view.render(parser.parseInline(`[**label**](${destination})`))).toBe(
      '<strong>label</strong>'
    )
  }
  expect(view.render(parser.parseInline('![**Uploading**]()'))).toBe(
    '!<strong>Uploading</strong>'
  )
  expect(
    view.render(parser.parseInline('![image](blob:https://example.test/id)'))
  ).toBe('!image')
})
