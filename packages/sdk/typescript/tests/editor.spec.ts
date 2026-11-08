import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { file } from 'bun'
import { expect, test } from 'bun:test'

import { createRuntime, presets } from '../../dist/index.js'
import { createHtmlRenderer } from '../../dist/renderer/index.js'
import { analyzeForEditing } from '../src/editor/index.js'

const bytes = await file(
  new URL('../../dist/parser.wasm', import.meta.url)
).bytes()

const runtime = await createRuntime(bytes)
const parser = runtime.createParser(presets.traq.v1)

test('editing ranges retain original Unicode, CRLF and accepted delimiters', () => {
  const source = '> 😀 **a\r\n> b**'
  const parsed = parser.parseWithSyntax(source)
  const analysis = analyzeForEditing(parsed)
  expect(parsed.document.document).toEqual(parser.parse(source).document)
  const strong = analysis.nodes.find(entry => entry.node.kind === names.Strong)!

  expect(
    strong.content.map(range => source.slice(range.from, range.to))
  ).toEqual(['a\r\n', 'b'])

  expect(
    strong.markers.flatMap(marker =>
      marker.ranges.map(range => source.slice(range.from, range.to))
    )
  ).toEqual(['**', '**'])

  expect(analyzeForEditing(parsed)).toBe(analysis)
  expect(Object.isFrozen(analysis.lines[0].containers)).toBe(true)
})

test('reference images render directly from the same document and keep detached definitions', () => {
  const parsed = parser.parseWithSyntax(
    '![alt][asset]\n\n[asset]: https://example.com/image.png'
  )

  const analysis = analyzeForEditing(parsed)
  const image = analysis.nodes.find(entry => entry.node.kind === names.Image)!

  expect(
    createHtmlRenderer({ images: { validate: () => true } })
      .createSession(parsed.document)
      .render({ roots: [image.node] })
  ).toContain('src="https://example.com/image.png"')

  expect(analysis.detached[0].kind).toBe('definition')
  const foreign = parser.parse('x').document.children[0]
  expect(() => parsed.syntaxFor(foreign)).toThrow(/does not belong/)
})

test('line contexts preserve containers, lazy continuation, literal blocks and partial tabs', () => {
  const source = '> - a\r\n>   b\r\n>   ```\r\n>   code\r\n>   ```'
  const analysis = analyzeForEditing(parser.parseWithSyntax(source))

  expect(
    analysis.lines[0].containers.map(part => part.continuation).join('')
  ).toBe('>   ')

  expect(analysis.lines[0].containers[1].list).toEqual({
    marker: '-',
    leading: '',
    spacing: ' '
  })

  expect(
    source.slice(analysis.lines[1].contentFrom, analysis.lines[1].to)
  ).toBe('b')

  expect(analysis.lines.map(line => line.literal)).toEqual([
    false,
    false,
    true,
    true,
    true
  ])

  const lazy = analyzeForEditing(parser.parseWithSyntax('> - a\ncontinued'))

  expect(lazy.lines[1]).toMatchObject({
    quoteDepth: 1,
    indent: 4,
    contentFrom: 6
  })

  const partial = analyzeForEditing(parser.parseWithSyntax('- a\n\t**b**'))

  expect(partial.lines[1].containers[0].prefix).toMatchObject({
    columns: 2,
    text: '  '
  })

  expect(
    analyzeForEditing(parser.parseWithSyntax('- - x')).lines[0].containers
  ).toHaveLength(2)

  expect(
    analyzeForEditing(parser.parseWithSyntax('-')).lines[0].containers[0]
      .continuation
  ).toBe('  ')

  const siblings = analyzeForEditing(parser.parseWithSyntax('> - a\n> - b'))
  expect(siblings.lines[1].containers).toHaveLength(2)
})

test('inline syntax capture and ordinary parsing remain independent', () => {
  const parsed = parser.parseInlineWithSyntax('***x*** $y$ :stamp:')

  expect(parsed.document.document).toEqual(
    parser.parseInline('***x*** $y$ :stamp:').document
  )

  expect(
    parsed.syntax.children[0].source!.markers.map(marker => marker.kind)
  ).toEqual(['open', 'close'])

  const analysis = analyzeForEditing(
    parser.parseWithSyntax('before\ufffc **after**')
  )

  const strong = analysis.nodes.find(entry => entry.node.kind === names.Strong)!
  expect(strong.content).toEqual([{ from: 10, to: 15 }])
})

test('syntax capture observes source and work limits without poisoning its parser', () => {
  expect(() => parser.parseWithSyntax('x'.repeat(65537))).toThrow()

  for (const source of [
    '\0'.repeat(65536),
    ('> '.repeat(30) + '\0'.repeat(400) + '\r\n').repeat(128)
  ]) {
    try {
      parser.parseWithSyntax(source)
    } catch (error) {
      expect(error).toMatchObject({ code: 'resource_limit' })
    }

    expect(parser.parseWithSyntax('after').document.document.source).toBe(
      'after'
    )
  }
})

test('the final empty line remains literal only for an open root block', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    for (const marker of ['```', '$$']) {
      for (const tail of ['', ' ', '\t']) {
        const open = analyzeForEditing(
          parser.parseWithSyntax(`${marker}${newline}body${newline}${tail}`)
        )

        expect(open.lines.at(-1)!.literal).toBe(true)
      }

      const closed = analyzeForEditing(
        parser.parseWithSyntax(
          `${marker}${newline}body${newline}${marker}${newline}`
        )
      )

      expect(closed.lines.at(-1)!.literal).toBe(false)

      for (const [prefix, continuation] of [
        ['> ', '> '],
        ['- ', '  ']
      ]) {
        const nested = analyzeForEditing(
          parser.parseWithSyntax(
            `${prefix}${marker}${newline}${continuation}body${newline}`
          )
        )

        expect(nested.lines.at(-1)!.literal).toBe(false)
      }
    }

    const indented = analyzeForEditing(
      parser.parseWithSyntax(`    body${newline}`)
    )

    expect(indented.lines.at(-1)!.literal).toBe(false)
  }
})
