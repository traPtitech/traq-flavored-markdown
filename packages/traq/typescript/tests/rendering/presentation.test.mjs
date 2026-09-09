import test from 'node:test'
import assert from 'node:assert/strict'
import { renderer } from '@traq-markdown-parser/core/renderer'
import * as rendering from '@traq-markdown-parser/traq/renderer'
import { parser, commonParser } from './setup.mjs'

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
    assert(html.includes(expected), expected)
  assert.match(view.render(parser.parse('one\ntwo')), /one<br>\ntwo/)
  assert.match(
    view.render(parser.parseInline('$\\invalidcommand$')),
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
  assert.match(first.render(document), /first\.example\/stamp/)
  assert.match(second.render(document), /second\.example\/icon/)
  assert.doesNotMatch(first.render(document), /second\.example/)
  assert.match(first.render(document), /background-color: #ff0000/)
  assert.equal(
    first.render(parser.parseInline(':wave.unknown:')),
    ':wave.unknown:'
  )
  assert.equal(first.render(parser.parseInline(':missing:')), ':missing:')
  const unsafe = renderer(
    rendering.html({
      store: {
        getStampByName: () => ({ name: 'wave', fileId: 'id' }),
        generateStampHref: () => 'javascript:alert(1)'
      }
    })
  )
  assert.equal(unsafe.render(parser.parseInline(':wave:')), ':wave:')
})

test('reference highlighting and link/image policies belong to each renderer', t => {
  const common = commonParser()
  t.after(() => common.dispose())
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
  assert.match(html, /message-user-link-highlight/)
  assert.match(html, /message-group-link-highlight/)
  assert.match(html, /href="#channel-c"/)
  assert.doesNotMatch(
    view.render(
      common.parseInline('![x](https://unlisted.example/x.png)')
    ),
    /<img/
  )
  assert.match(
    view.render(common.parseInline('![x](https://trap.jp/x.png)')),
    /<img/
  )
  const custom = renderer(
    rendering.html({ validateImage: () => true, validateLink: () => false })
  )
  assert.match(
    custom.render(
      common.parseInline('![x](https://unlisted.example/x.png)')
    ),
    /<img/
  )
  assert.equal(
    custom.render(parser.parseInline('[x](https://example.com)')),
    'x'
  )
})

test('table handlers reject forged row and cell payloads', () => {
  const view = renderer(rendering.html())
  const document = parser.parse('| a |\n| - |\n| b |')
  const cell = document.children[0].children[0].children[0]
  cell.data.alignment = 'left;position:fixed'
  assert.throws(() => view.render(document), /Invalid table cell/)
})
