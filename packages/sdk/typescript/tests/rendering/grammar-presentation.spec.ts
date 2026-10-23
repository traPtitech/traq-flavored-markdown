import * as common from '@traq-flavored-markdown/commonmark-plugin/renderer'
import * as traq from '@traq-flavored-markdown/sdk/renderer'
import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { Node } from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

import { commonParser, parser } from './setup.ts'

test('empty quote visibility belongs to traQ presentation without synthetic AST children', () => {
  const document = parser.parse('>')
  expect(document.children[0].kind).toBe(names.Blockquote)
  expect(document.children[0].children ?? []).toEqual([])
  expect(common.html().render(document)).toBe('<blockquote>\n</blockquote>\n')
  expect(traq.html().render(document)).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  expect(traq.html({ presentation: { xhtmlOut: true } }).render(document)).toBe(
    '<blockquote>\n<br />\n</blockquote>\n'
  )
  expect(traq.html().render(parser.parse('>\n'))).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  const view = traq.messageRenderers({ origin: 'https://q.example.test' })
  expect(view.standard.render(document).html).toBe(
    '<blockquote>\n<br>\n</blockquote>\n'
  )
  expect(view.condensed.render(document).html).toBe('> ')
  expect(
    traq
      .html({
        configurePlugins: plugins => ({
          ...plugins,
          common: plugins.common.replace(
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
      const image = document.children[0].children![0]
      expect(image.kind).toBe(names.Image)
      const expectedImage = `<img src="${url}" alt="alt">`
      expect(
        traq.html({ images: { validate: () => true } }).render(document)
      ).toBe(`<p>${expectedImage}</p>\n`)
      expect(
        traq.html({ images: { validate: () => false } }).render(document)
      ).toBe(`<p>${source.split('\n')[0]}</p>\n`)
      expect(traq.html().render(document).includes('<img')).toBe(
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
  expect(parser.parseInline('[x](javascript:alert)').children[0].kind).toBe(
    names.Link
  )
  const nested = parser.parseInline(
    '[outer <https://inner.test>](https://outer.test)'
  )
  const visit = (nodes: readonly Node[], insideLink = false) => {
    for (const node of nodes) {
      if (node.kind === names.Link) expect(insideLink).toBe(false)
      if (node.children)
        visit(node.children, insideLink || node.kind === names.Link)
    }
  }
  visit(nested.children)
  expect(nested.children[0].kind).toBe(names.Text)
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
    [common.html(commonUndefined), common.html()],
    [traq.html(undefinedOptions), traq.html()]
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
      .html(undefinedOptions)
      .render(parser.parseInline('![x](http://trap.jp/a.png)'))
  ).toBe('![x](http://trap.jp/a.png)')
  expect(
    traq
      .html(undefinedOptions)
      .render(parser.parseInline('![x](https://unlisted.test/a.png)'))
  ).toBe('![x](https://unlisted.test/a.png)')
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
    const snapshot = structuredClone(document)
    const views = traq.messageRenderers({ origin })
    for (const view of [views.standard, views.condensed]) {
      expect(view.render(document).cards).toEqual([])
    }
    expect(document).toEqual(snapshot)
  }
})

test('additional blank lines retain source ranges and trailing-card presentation', () => {
  const document = parser.parse('a\n\n\nb')
  expect(traq.html().render(document)).toBe('<p>a</p>\n<br>\n<p>b</p>\n')
  const blanks: Node[] = []
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (node.kind === 'traq.blank_line') blanks.push(node)
      if (node.children) visit(node.children)
    }
  }
  visit(document.children)
  expect(blanks).toHaveLength(1)
  expect(document.source.slice(blanks[0].span.start, blanks[0].span.end)).toBe(
    '\n'
  )
  const origin = 'https://q.example.test'
  const file = origin + '/files/00000000-0000-0000-0000-000000000001'
  const view = traq.messageRenderers({ origin })
  expect(view.standard.render(parser.parse('a\n' + file + '\n\n\n')).html).toBe(
    '<p>a</p>\n'
  )
})
