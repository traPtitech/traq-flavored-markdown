import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import { createRenderer } from '@traq-flavored-markdown/core/renderer'
import { withDefaultAdapters } from '@traq-flavored-markdown/sdk/adapters'
import { expect, test } from 'bun:test'

import { parser } from './setup.js'

test('traQ presentation combines tables, marks, spoilers, math, and highlighted code', () => {
  const view = createRenderer(rendering.createHtmlPreset(withDefaultAdapters()))
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

test('stamp resolvers are isolated and unrecognized effects preserve escaped source', () => {
  const make = (origin: string) =>
    createRenderer(
      rendering.createHtmlPreset({
        stamps: {
          resolve: ({ type, name }) =>
            type === 'normal' && name === 'wave'
              ? { url: origin + '/stamp' }
              : type === 'user' && name === 'alice'
                ? { url: origin + '/icon' }
                : undefined
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
  const unsafe = createRenderer(
    rendering.createHtmlPreset({
      stamps: {
        resolve: () => ({ url: 'javascript:alert(1)' })
      }
    })
  )
  expect(unsafe.render(parser.parseInline(':wave:'))).toBe(':wave:')
  const nonImage = createRenderer(
    rendering.createHtmlPreset({
      stamps: {
        resolve: () => ({ url: 'tel:+819012345678' })
      }
    })
  )
  expect(nonImage.render(parser.parseInline(':wave:'))).toBe(':wave:')
})

test('stamp presentation uses parsed kinds and effects without matching color substrings', () => {
  const view = createRenderer(
    rendering.createHtmlPreset({
      stamps: {
        resolve: ({ name }) =>
          ['foo0x123456', '0x1234567', 'wave'].includes(name)
            ? { url: `https://stamps.example/${name}` }
            : undefined
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

test('hex color stamps render complete RGB and RGBA values without resolving image stamps', () => {
  const view = createRenderer(
    rendering.createHtmlPreset({
      stamps: {
        resolve: () => {
          throw new Error('Colors must not resolve image stamps')
        }
      }
    })
  )
  for (const [literal, kind, value, digits] of [
    [':0xF00:', 'hex_color', 0xff0000, 'ff0000'],
    [':0x0aF:', 'hex_color', 0x00aaff, '00aaff'],
    [':0xff0000:', 'hex_color', 0xff0000, 'ff0000'],
    [':0xF008.rotate.small:', 'hex_rgba_color', 0xff000088, 'ff000088'],
    [':0x0aF0:', 'hex_rgba_color', 0x00aaff00, '00aaff00'],
    [':0xff000080:', 'hex_rgba_color', 0xff000080, 'ff000080'],
    [':0x00000001:', 'hex_rgba_color', 1, '00000001'],
    [':0xFFFFFFFF:', 'hex_rgba_color', 0xffffffff, 'ffffffff']
  ] as const) {
    const document = parser.parseInline(literal)
    expect(document.document.children).toHaveLength(1)
    expect(document.document.children[0].data).toMatchObject({
      literal,
      kind: { type: kind, [kind === 'hex_color' ? 'rgb' : 'rgba']: value }
    })
    const html = view.render(document)
    expect(html).toContain(`background-color: #${digits};`)
    expect(html).toContain(`title=":0x${digits}:"`)
    if (literal.includes('.rotate.small'))
      expect(html).toContain('emoji-effect rotate small')
  }
  const unresolved = createRenderer(rendering.createHtmlPreset())
  for (const name of [
    '0x12',
    '0x12345',
    '0xff7383f',
    '0x123456789',
    '0x1234567z',
    'foo0xf00'
  ])
    expect(unresolved.render(parser.parseInline(`:${name}:`))).toBe(`:${name}:`)
})

test('reference highlighting and link/image policies belong to each renderer', () => {
  const view = createRenderer(
    rendering.createHtmlPreset({
      references: {
        resolve: ({ type, id }) => ({
          href: '#' + type + '-' + id,
          highlight: type === 'group' || (type === 'user' && id === 'me')
        })
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
    view.render(parser.parseInline('![x](https://unlisted.example/x.png)'))
  ).not.toMatch(/<img/)
  expect(
    view.render(parser.parseInline('![x](https://trap.jp/x.png)'))
  ).toMatch(/<img/)
  const custom = createRenderer(
    rendering.createHtmlPreset({
      images: { validate: () => true },
      links: { validate: () => false }
    })
  )
  expect(
    custom.render(parser.parseInline('![x](https://unlisted.example/x.png)'))
  ).toMatch(/<img/)
  expect(
    custom.render(parser.parseInline('[x](https://example.com)')),
    '[x](https://example.com)'
  ).toBe('[x](https://example.com)')
})

test('reference rendering rejects script links and escapes labels', () => {
  const view = createRenderer(
    rendering.createHtmlPreset({
      references: {
        resolve: ({ id }) => ({ href: `javascript:openModal(${id})` })
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

test('table handlers reject forged alignment metadata', () => {
  const view = rendering.createHtmlRenderer()
  const document = parser.parse('| a |\n| - |\n| b |').toMutable()
  const table = document.children[0]
  table.data = { alignments: ['left;position:fixed'] } as never
  expect(() => view.render(document)).toThrow(/Invalid node payload/)
})
