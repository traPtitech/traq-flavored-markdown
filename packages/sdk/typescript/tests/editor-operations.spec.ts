import { file } from 'bun'
import { afterAll, expect, test } from 'bun:test'

import { createRuntime, presets } from '../../dist/index.js'
import {
  analyzeForEditing,
  describeSource,
  isLiteralSource,
  planIndent,
  planLineBreak
} from '../src/editor/index.js'
import type { EditPlan } from '../src/editor/index.js'

const runtime = await createRuntime(
  await file(new URL('../../dist/parser.wasm', import.meta.url)).bytes()
)
const parser = runtime.createParser(presets.traq.v1)
afterAll(() => runtime.dispose())
const analyze = (source: string) =>
  analyzeForEditing(parser.parseWithSyntax(source))
const apply = (source: string, plan: EditPlan) => {
  for (const change of [...plan.changes].reverse())
    source =
      source.slice(0, change.from) + change.text + source.slice(change.to)
  return source
}

test('source descriptions preserve disjoint content and original node identities', () => {
  const source = '> 😀 **a\r\n> b** and [label](https://example.com)'
  const editing = analyze(source)
  const description = describeSource(editing)
  const strong = description.nodes.find(
    node => node.kind === 'style' && node.style === 'strong'
  )!
  expect(
    strong.content.map(range => source.slice(range.from, range.to))
  ).toEqual(['a\r\n', 'b'])
  expect(
    strong.syntax.map(range => source.slice(range.from, range.to))
  ).toEqual(['**', '**'])
  expect(editing.nodes.some(entry => entry.node === strong.native)).toBe(true)
  expect(description.document).toBe(editing.document)
  expect(describeSource(editing)).toBe(description)
  expect(Object.isFrozen(description)).toBe(true)
  expect(Object.isFrozen(strong.content)).toBe(true)
  expect(Object.isFrozen(strong.content[0])).toBe(true)
})

test('source descriptions retain delimiters without deciding which source an editor hides', () => {
  const source = '$math$ :stamp: ![alt](https://example.com/a.png)'
  const nodes = describeSource(analyze(source)).nodes
  const syntax = (kind: string) =>
    nodes
      .find(node => node.kind === kind)!
      .syntax.map(range => source.slice(range.from, range.to))
  expect(syntax('math')).toEqual(['$', '$'])
  expect(syntax('stamp')).toEqual([])
  expect(syntax('image')).toEqual(['![', '](https://example.com/a.png)'])
})

test.each([
  '# heading\r\n',
  '```\n```',
  '> ```\r\n> 😀\r\n> ```\r\n',
  '- **a\n  b**',
  '![alt][asset]\n\n[asset]: https://example.com/x.png',
  '$x$\n\n$$\ny\n$$',
  ':stamp: !!hidden!!',
  '| a | b |\n| - | - |\n| c | d |'
])('source descriptions keep every range within its node: %s', source => {
  for (const node of describeSource(analyze(source)).nodes) {
    expect(node.from).toBeGreaterThanOrEqual(0)
    expect(node.to).toBeLessThanOrEqual(source.length)
    for (const range of [...node.content, ...node.syntax]) {
      expect(range.from).toBeGreaterThanOrEqual(node.from)
      expect(range.to).toBeGreaterThanOrEqual(range.from)
      expect(range.to).toBeLessThanOrEqual(node.to)
    }
  }
})

test('list marker ranges exclude continuation prefixes and literals keep their classification', () => {
  const source = '> - **a**\n>   b\n\n`code` $math$'
  const result = describeSource(analyze(source))
  expect(
    result.nodes
      .filter(node => node.kind === 'list-marker')
      .flatMap(node =>
        node.content.map(range => source.slice(range.from, range.to))
      )
  ).toEqual(['-'])
  expect(result.nodes.filter(isLiteralSource).map(node => node.kind)).toEqual([
    'code',
    'math'
  ])
})

test.each([
  ['plain¦', 'plain\n¦'],
  ['> a\nlazy¦', '> a\nlazy\n> ¦'],
  ['> > a\n> > ¦', '> > a\n> \n> ¦'],
  ['12) 😀¦', '12) 😀\n13) ¦'],
  ['1.\ta¦', '1.\ta\n2.\t¦'],
  ['- a\n  - b\n    ¦', '- a\n  - b\n  \n  ¦'],
  ['> - a\r\n>   ¦', '> - a\r\n> \r\n> ¦'],
  ['> ```\n> - literal¦\n> ```', '> ```\n> - literal\n> ¦\n> ```'],
  ['-     code¦', '-     code\n      ¦']
])(
  'line break plans continue or exit parser-owned containers: %s',
  (before, after) => {
    const source = before.replace('¦', '')
    const position = before.indexOf('¦')
    const plan = planLineBreak(
      source,
      { from: position, to: position },
      { analyze }
    )
    expect(apply(source, plan)).toBe(after.replace('¦', ''))
    expect(plan.selection).toEqual({
      from: after.indexOf('¦'),
      to: after.indexOf('¦')
    })
  }
)

test('soft line breaks and selected replacements have no list completion', () => {
  const source = '> 12. item'
  const plan = planLineBreak(
    source,
    { from: source.length, to: source.length },
    { analyze, continueItem: true }
  )
  expect(apply(source, plan)).toBe('> 12. item\n>     ')
  expect(plan.completion).toBeUndefined()
  const replacement = planLineBreak(
    source,
    { from: 2, to: source.length },
    { analyze }
  )
  expect(apply(source, replacement)).toBe('> \n')
  expect(replacement.completion).toBeUndefined()
})

test('list completion uses resulting UTF-16 coordinates including CRLF', () => {
  const source = 'previous\r\n\r\n12. 😀'
  const plan = planLineBreak(
    source,
    { from: source.length, to: source.length },
    { analyze }
  )
  const result = apply(source, plan)
  expect(result).toBe('previous\r\n\r\n12. 😀\r\n13. ')
  expect(plan.completion).toMatchObject({
    text: '13. ',
    continuation: '    ',
    child: '    1. '
  })
  expect(result.slice(plan.completion!.from, plan.completion!.to)).toBe('13. ')
  expect(Object.isFrozen(plan.completion)).toBe(true)
})

test('multiline indentation uses original coordinates and preserves selection endpoints', () => {
  const source = '😀\r\nb\r\nc'
  const plan = planIndent(source, { from: 0, to: 7 })
  expect(apply(source, plan)).toBe('  😀\r\n  b\r\nc')
  expect(plan.selection).toEqual({ from: 2, to: 11 })
  expect(plan.changes.map(change => change.from)).toEqual([0, 4])
  const undo = planIndent(apply(source, plan), plan.selection, 'outdent')
  expect(apply(apply(source, plan), undo)).toBe(source)
  expect(undo.selection).toEqual({ from: 0, to: 7 })
  expect(Object.isFrozen(plan.changes[0])).toBe(true)
  const tab = planIndent('\tx', { from: 1, to: 1 }, 'outdent')
  expect(apply('\tx', tab)).toBe('x')
  expect(tab.selection).toEqual({ from: 0, to: 0 })
})

test('edit plans reject invalid ranges and UTF-16 boundaries', () => {
  for (const selection of [
    { from: -1, to: 0 },
    { from: 0, to: 4 },
    { from: 2, to: 1 },
    { from: 1, to: 1 }
  ]) {
    expect(() => planIndent('😀x', selection)).toThrow(RangeError)
    expect(() => planLineBreak('😀x', selection, { analyze })).toThrow(
      RangeError
    )
  }
  expect(() => planIndent('x', { from: 0, to: 0 }, 'indent', 0)).toThrow(
    RangeError
  )
})
