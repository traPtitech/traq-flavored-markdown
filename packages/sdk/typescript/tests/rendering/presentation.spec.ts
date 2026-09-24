import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

import { commonParser, parser } from './setup.ts'

test('traQ presentation combines tables, marks, spoilers, math, and highlighted code', () => {
  const view = renderer(rendering.htmlPreset())
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
  const make = (origin: string) =>
    renderer(
      rendering.htmlPreset({
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
    rendering.htmlPreset({
      store: {
        getStampByName: () => ({ name: 'wave', fileId: 'id' }),
        generateStampHref: () => 'javascript:alert(1)'
      }
    })
  )
  expect(unsafe.render(parser.parseInline(':wave:'))).toBe(':wave:')
  const nonImage = renderer(
    rendering.htmlPreset({
      store: {
        getStampByName: () => ({ name: 'wave', fileId: 'id' }),
        generateStampHref: () => 'tel:+819012345678'
      }
    })
  )
  expect(nonImage.render(parser.parseInline(':wave:'))).toBe(':wave:')
})

test('stamp presentation uses parsed kinds and effects without matching color substrings', () => {
  const view = renderer(
    rendering.htmlPreset({
      store: {
        getStampByName: name =>
          ['foo0x123456', '0x1234567', 'wave'].includes(name)
            ? { name, fileId: name }
            : undefined,
        generateStampHref: id => `https://stamps.example/${id}`
      }
    })
  )
  const source = ':foo0x123456: :0x1234567: :0x123456: :hsl(0, 20.5%, 30%):'
  const output = view.render(parser.parseInline(source))
  expect(output).toContain('https://stamps.example/foo0x123456')
  expect(output).toContain('https://stamps.example/0x1234567')
  expect(output).toContain('background-color: #123456;')
  expect(output).toContain('background-color: hsl(0, 20.5%, 30%);')
  expect(view.render(parser.parseInline(':foohsl(0, 20%, 30%):'))).toBe(
    ':foohsl(0, 20%, 30%):'
  )

  const effects = view.render(
    parser.parseInline(':wave.marquee.large.rotate.small:')
  )
  expect(effects).toContain('emoji-effect conga small')
  expect(effects).toContain('emoji-effect rotate')
  expect(effects).not.toContain('marquee')
  expect(
    view.render(
      parser.parseInline(':wave.rotate.rotate.rotate.rotate.rotate.rotate:')
    )
  ).toBe(':wave.rotate.rotate.rotate.rotate.rotate.rotate:')
})

test('reference highlighting and link/image policies belong to each renderer', () => {
  const common = commonParser()
  const view = renderer(
    rendering.htmlPreset({
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
    rendering.htmlPreset({
      validateImage: () => true,
      validateLink: () => false
    })
  )
  expect(
    custom.render(common.parseInline('![x](https://unlisted.example/x.png)'))
  ).toMatch(/<img/)
  expect(
    custom.render(parser.parseInline('[x](https://example.com)')),
    '[x](https://example.com)'
  ).toBe('[x](https://example.com)')
})

test('reference rendering rejects script links and escapes labels', () => {
  const view = renderer(
    rendering.htmlPreset({
      store: {
        generateUserHref: id => `javascript:openUserModal(${id})`,
        generateUserGroupHref: id => `javascript:openGroupModal(${id})`
      }
    })
  )
  const label = '<img src=x onerror=alert(1)>'

  for (const type of ['user', 'group']) {
    const source =
      '!' +
      JSON.stringify({
        type,
        id: "');alert(1);//",
        raw: label
      })
    expect(view.render(parser.parseInline(source))).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    )
  }
})

test('table handlers reject forged row and cell payloads', () => {
  const view = renderer(rendering.htmlPreset())
  const document = parser.parse('| a |\n| - |\n| b |')
  const cell = document.children![0]!.children![0]!.children![0]! as {
    data: { alignment: string }
  }
  cell.data.alignment = 'left;position:fixed'
  expect(() => view.render(document)).toThrow(/Invalid table cell/)
})
