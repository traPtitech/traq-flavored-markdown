import {
  createHtmlRenderer,
  messageRenderers
} from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import { parser } from './setup.js'

test('bare URLs trim GFM delimiters while explicit URLs preserve them', () => {
  const view = createHtmlRenderer()
  for (const [source, destination, formatting] of [
    ['~~https://example.test/a~~', 'https://example.test/a', '<s>'],
    ['~~\\https://example.test/a~~', 'https://example.test/a', '<s>'],
    ['~~<https://example.test/a~~>~~', 'https://example.test/a~~', '<s>'],
    ['[label](https://example.test/a~)', 'https://example.test/a~', 'label'],
    ['https://example.test/a_(b', 'https://example.test/a_(b', ''],
    ['https://example.test/a_(b))', 'https://example.test/a_(b)', ''],
    ['https://example.test/a_(b))+ok', 'https://example.test/a_(b))+ok', ''],
    ['word-https://example.test/a', 'https://example.test/a', 'word-'],
    [
      'https://example.test/__name__/end',
      'https://example.test/__name__/end',
      ''
    ],
    ['https://example.test/__name__', 'https://example.test/__name', '']
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
