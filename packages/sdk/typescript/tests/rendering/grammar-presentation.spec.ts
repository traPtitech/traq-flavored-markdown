import * as common from '@traq-flavored-markdown/commonmark-plugin/renderer'
import * as traq from '@traq-flavored-markdown/sdk/renderer'
import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { ReadonlyNode } from '@traq-flavored-markdown/core/renderer'
import { math } from '@traq-flavored-markdown/extensions-plugin/math'
import { names as extensionNames } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { expect, test } from 'bun:test'

import { commonParser, parser } from './setup.js'

test('display math tolerates trailing whitespace and up to three spaces without consuming following text', () => {
  const view = traq.createHtmlRenderer({ math: { render: math } })
  for (const indent of ['', ' ', '  ', '   ']) {
    for (const suffix of [' ', '\t', ' \t  ']) {
      const document = parser.parse(
        `説明\n${indent}$$x^2 + y^2$$${suffix}\n続く説明`
      )
      expect(document.document.children.map(node => node.kind)).toEqual([
        names.Paragraph,
        extensionNames.BlockMath,
        names.Paragraph
      ])
      const html = view.render(document)
      expect(html).toContain('katex-display')
      expect(html).not.toContain('katex-error')
      expect(html).toEndWith('<p>続く説明</p>\n')
    }
  }
})

test('indented math after a list remains a display formula in its own block', () => {
  const document = parser.parse(
    ' 8. 項目\n\n    $$x + y$$\n\n   $$x - y$$\n\n続く説明'
  )
  expect(document.document.children.map(node => node.kind)).toEqual([
    names.List,
    extensionNames.BlockMath,
    names.Paragraph
  ])
  const html = traq
    .createHtmlRenderer({ math: { render: math } })
    .render(document)
  expect(html.match(/class="katex-display"/g)).toHaveLength(2)
  expect(html).not.toContain('katex-error')
  expect(html).not.toContain('$$')
  expect(html).toEndWith('<p>続く説明</p>\n')
})

test('empty quote visibility belongs to traQ presentation without synthetic AST children', () => {
  const document = parser.parse('>')
  expect(document.document.children[0].kind).toBe(names.Blockquote)
  expect(document.document.children[0].children ?? []).toEqual([])
  expect(common.createHtmlRenderer().render(document)).toBe(
    '<blockquote>\n</blockquote>\n'
  )
  expect(traq.createHtmlRenderer().render(document)).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  expect(
    traq
      .createHtmlRenderer({ presentation: { xhtmlOut: true } })
      .render(document)
  ).toBe('<blockquote>\n<br />\n</blockquote>\n')
  expect(traq.createHtmlRenderer().render(parser.parse('>\n'))).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  const view = traq.messageRenderers({ origin: 'https://q.example.test' })
  expect(view.standard.render(document).html).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  expect(view.condensed.render(document).html).toBe('> ')
  expect(
    traq
      .createHtmlRenderer({
        configurePlugins: plugins => ({
          ...plugins,
          common: plugins.common.withReplacedHandler(
            names.Blockquote,
            () => '<aside></aside>'
          )
        })
      })
      .render(document)
  ).toBe('<aside></aside>')
})

test('direct and reference images share parsing and renderer-specific image policy', () => {
  for (const url of ['https://trap.jp/a.png', 'https://unlisted.test/a.png']) {
    for (const source of [
      `![alt](${url})`,
      `![alt][image]\n\n[image]: ${url}`
    ]) {
      const document = parser.parse(source)
      const image = document.document.children[0].children![0]
      expect(image.kind).toBe(names.Image)
      const expectedImage = `<img src="${url}" alt="alt">`
      expect(
        traq
          .createHtmlRenderer({ images: { validate: () => true } })
          .render(document)
      ).toBe(`<p>${expectedImage}</p>\n`)
      expect(
        traq
          .createHtmlRenderer({ images: { validate: () => false } })
          .render(document)
      ).toBe(
        `<p>!<a href="${url}" target="_blank" rel="nofollow noopener noreferrer">alt</a></p>\n`
      )
      expect(traq.createHtmlRenderer().render(document).includes('<img')).toBe(
        url.startsWith('https://trap.jp/')
      )
    }
  }
})

test('traQ uses CommonMark link nesting and keeps URL policy out of parsing', () => {
  const local = commonParser()
  try {
    for (const source of [
      '[x](javascript:alert)',
      '[x](file:///tmp/example)',
      '<javascript:alert>'
    ])
      expect(parser.parseInline(source)).toEqual(local.parseInline(source))
  } finally {
    local.dispose()
  }
  expect(
    parser.parseInline('[x](javascript:alert)').document.children[0].kind
  ).toBe(names.Link)
  const nested = parser.parseInline(
    '[outer <https://inner.test>](https://outer.test)'
  )
  const visit = (nodes: readonly ReadonlyNode[], insideLink = false) => {
    for (const node of nodes) {
      if (node.kind === names.Link) expect(insideLink).toBe(false)
      if (node.children)
        visit(node.children, insideLink || node.kind === names.Link)
    }
  }
  visit(nested.document.children)
  expect(nested.document.children[0].kind).toBe(names.Text)
})

test('omitted and undefined display options keep the same URL and raw HTML policies', () => {
  const commonUndefined = {
    validateLink: undefined,
    validateImage: undefined,
    rawHtml: undefined,
    xhtmlOut: undefined,
    breaks: undefined
  }
  const undefinedOptions = {
    links: { validate: undefined },
    images: { validate: undefined },
    presentation: { rawHtml: undefined, xhtmlOut: undefined, breaks: undefined }
  }
  for (const [view, baseline] of [
    [common.createHtmlRenderer(commonUndefined), common.createHtmlRenderer()],
    [traq.createHtmlRenderer(undefinedOptions), traq.createHtmlRenderer()]
  ]) {
    for (const source of [
      '[x](javascript:alert)',
      '<javascript:alert>',
      '![x](javascript:alert)',
      '![x](data:image/png;base64,eA==)',
      '<script>alert(1)</script>',
      'a\nb'
    ]) {
      const document = parser.parse(source)
      expect(view.render(document)).toBe(baseline.render(document))
      expect(view.render(document)).not.toMatch(
        /<script|(?:href|src)="(?:javascript|data):/
      )
    }
  }
  expect(
    traq
      .createHtmlRenderer(undefinedOptions)
      .render(parser.parseInline('![x](http://trap.jp/a.png)'))
  ).toBe(
    '!<a href="http://trap.jp/a.png" target="_blank" rel="nofollow noopener noreferrer">x</a>'
  )
  expect(
    traq
      .createHtmlRenderer(undefinedOptions)
      .render(parser.parseInline('![x](https://unlisted.test/a.png)'))
  ).toBe(
    '!<a href="https://unlisted.test/a.png" target="_blank" rel="nofollow noopener noreferrer">x</a>'
  )
})

test('rejected images remain safe links without creating nested anchors', () => {
  const view = traq.createHtmlRenderer({ images: { validate: () => false } })
  const attributes = ' target="_blank" rel="nofollow noopener noreferrer"'
  expect(
    view.render(
      parser.parseInline(
        '![**bold** `code` &quot;](https://example.test/a.png "title")'
      )
    )
  ).toBe(
    `!<a href="https://example.test/a.png"${attributes} title="title">bold code &quot;</a>`
  )
  expect(
    view.render(
      parser.parseInline(
        '[![alt](https://example.test/a.png)](https://example.test/page)'
      )
    )
  ).toBe(`<a href="https://example.test/page"${attributes}>!alt</a>`)
  expect(
    view.render(
      parser.parseInline('![<https://inner.test>](https://outer.test/a.png)')
    )
  ).toBe(
    `!<a href="https://outer.test/a.png"${attributes}>https://inner.test</a>`
  )
  for (const destination of [
    'javascript:alert(1)',
    'data:image/png;base64,eA=='
  ]) {
    const html = view.render(parser.parseInline(`![image](${destination})`))
    expect(html).not.toContain('<a')
    expect(html).not.toContain('<img')
  }
})

test('linked direct and reference images retain the outer link across display policies', () => {
  const image = 'https://images.example.test/badge.svg'
  const page = 'https://example.test/docs'
  const attributes = ' target="_blank" rel="nofollow noopener noreferrer"'
  for (const source of [
    `[![**badge**](${image} "image title")](${page} "page title")`,
    `[![**badge**][image]][page]\n\n[image]: ${image} "image title"\n[page]: ${page} "page title"`
  ]) {
    const document = parser.parse(source)
    const outerLink = (content: string) =>
      `<p><a href="${page}"${attributes} title="page title">${content}</a></p>\n`
    expect(
      traq
        .createHtmlRenderer({ images: { validate: () => true } })
        .render(document)
    ).toBe(outerLink(`<img src="${image}" alt="badge" title="image title">`))
    for (const validate of [undefined, (url: string) => url === page]) {
      expect(
        traq
          .createHtmlRenderer({
            images: { validate: () => false },
            links: { validate }
          })
          .render(document)
      ).toBe(outerLink('!badge'))
    }
  }
})

test('image alt links never create message cards and rendering leaves the AST intact', () => {
  const origin = 'https://q.example.test'
  const file = origin + '/files/00000000-0000-0000-0000-000000000001'
  for (const imageUrl of [
    'https://trap.jp/a.png',
    'https://unlisted.test/a.png'
  ]) {
    const document = parser.parse(
      `![<${file}> [alt](https://example.test/card)](${imageUrl})`
    )
    const snapshot = document.toMutable()
    const views = traq.messageRenderers({ origin })
    for (const view of [views.standard, views.condensed]) {
      expect(view.render(document).cards).toEqual([])
    }
    expect(document.document).toEqual(snapshot)
  }
})

test('additional blank lines retain source ranges and trailing-card presentation', () => {
  const document = parser.parse('a\n\n\nb')
  expect(traq.createHtmlRenderer().render(document)).toBe(
    '<p>a</p>\n<br>\n<p>b</p>\n'
  )
  const blanks: ReadonlyNode[] = []
  const visit = (nodes: readonly ReadonlyNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'traq.blank_line') blanks.push(node)
      if (node.children) visit(node.children)
    }
  }
  visit(document.document.children)
  expect(blanks).toHaveLength(1)
  expect(document.source.slice(blanks[0].span)).toBe('\n')
  const origin = 'https://q.example.test'
  const file = origin + '/files/00000000-0000-0000-0000-000000000001'
  const view = traq.messageRenderers({ origin })
  expect(view.standard.render(parser.parse('a\n' + file + '\n\n\n')).html).toBe(
    '<p>a</p>\n'
  )
})
