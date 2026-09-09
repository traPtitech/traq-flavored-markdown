import * as rendering from '@traq-markdown-parser/traq/renderer'
import { renderer } from '@traq-markdown-parser/core/renderer'
import { expect, test } from 'bun:test'

import { commonParser, parser } from './setup.ts'

test('traQ presentation combines tables, marks, spoilers, math, and highlighted code', () => {
  const view = renderer(rendering.html())
  const source =
    '| left | right |\n| :--- | ---: |\n| **a** | b |\n\n==mark== ~~strike~~ !!secret!! $x$\n\n```js:caption\nconst x = 1\n```'
  const html = view.render(parser.parse(source))
  for (const expected of [
    '<table>',
    'text-align:left',
    'text-align:right',
    '<strong>a</strong>',
    '<mark>mark</mark>',
    '<s>strike</s>',
    'class="spoiler"',
    'class="katex"',
    'traq-code traq-lang',
    '<cite>caption</cite>',
    'hljs-keyword'
  ])
    expect(html.includes(expected)).toBeTruthy()
  expect(view.render(parser.parse('one\ntwo'))).toMatch(/one<br>\ntwo/)
  expect(view.render(parser.parseInline('$\\invalidcommand$'))).toMatch(
    /katex-error/
  )
})

test('stamp stores are isolated and unrecognized effects preserve escaped source', () => {
  const make = origin =>
    renderer(
      rendering.html({
        store: {
          getStampByName: name =>
            name === 'wave' ? { name, fileId: 'stamp' } : undefined,
          getUserByName: name =>
            name === 'alice' ? { iconFileId: 'icon' } : undefined,
          generateStampHref: id => origin + '/' + id
        }
      })
    )
  const first = make('https://first.example'),
    second = make('https://second.example')
  const document = parser.parseInline(':wave: :@alice: :0xff0000: :wave.spin:')
  expect(first.render(document)).toMatch(/first\.example\/stamp/)
  expect(second.render(document)).toMatch(/second\.example\/icon/)
  expect(first.render(document)).not.toMatch(/second\.example/)
  expect(first.render(document)).toMatch(/background-color: #ff0000/)
  expect(
    first.render(parser.parseInline(':wave.unknown:')),
    ':wave.unknown:'
  ).toBe(':wave.unknown:')
  expect(first.render(parser.parseInline(':missing:'))).toBe(':missing:')
  const unsafe = renderer(
    rendering.html({
      store: {
        getStampByName: () => ({ name: 'wave', fileId: 'id' }),
        generateStampHref: () => 'javascript:alert(1)'
      }
    })
  )
  expect(unsafe.render(parser.parseInline(':wave:'))).toBe(':wave:')
})

test('reference highlighting and link/image policies belong to each renderer', () => {
  const common = commonParser()
  const view = renderer(
    rendering.html({
      store: {
        getMe: () => ({ id: 'me' }),
        getUserGroup: () => ({ members: [{ id: 'me' }] }),
        generateUserHref: id => '#user-' + id,
        generateUserGroupHref: id => '#group-' + id,
        generateChannelHref: id => '#channel-' + id
      }
    })
  )
  const source =
    '!{"type":"user","id":"me","raw":"@me"} !{"type":"group","id":"g","raw":"@group"} !{"type":"channel","id":"c","raw":"#channel"}'
  const html = view.render(parser.parseInline(source))
  expect(html).toMatch(/message-user-link-highlight/)
  expect(html).toMatch(/message-group-link-highlight/)
  expect(html).toMatch(/href="#channel-c"/)
  expect(
    view.render(common.parseInline('![x](https://unlisted.example/x.png)'))
  ).not.toMatch(/<img/)
  expect(
    view.render(common.parseInline('![x](https://trap.jp/x.png)'))
  ).toMatch(/<img/)
  const custom = renderer(
    rendering.html({ validateImage: () => true, validateLink: () => false })
  )
  expect(
    custom.render(common.parseInline('![x](https://unlisted.example/x.png)'))
  ).toMatch(/<img/)
  expect(
    custom.render(parser.parseInline('[x](https://example.com)')),
    'x'
  ).toBe('x')
})

test('table handlers reject forged row and cell payloads', () => {
  const view = renderer(rendering.html())
  const document = parser.parse('| a |\n| - |\n| b |')
  const cell = document.children[0].children[0].children[0] as {
    data: { alignment: string }
  }
  cell.data.alignment = 'left;position:fixed'
  expect(() => view.render(document)).toThrow(/Invalid table cell/)
})
