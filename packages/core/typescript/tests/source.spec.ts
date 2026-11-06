import { expect, test } from 'bun:test'

import sourceFixtures from '../../../../tests/fixtures/source-spans.json' with { type: 'json' }
import type { MutableNode } from '../src/ast.js'
import { DocumentContext } from '../src/document.js'
import { SourceText } from '../src/source.js'

test('UTF-8 and UTF-16 offsets roundtrip scalar boundaries and preserve original spelling', () => {
  const source = new SourceText('\uFEFF猫😀\r\n\0é')
  const boundaries = [
    [0, 0],
    [3, 1],
    [6, 2],
    [10, 4],
    [11, 5],
    [12, 6],
    [13, 7],
    [14, 8],
    [16, 9]
  ]
  for (const [byte, unit] of boundaries) {
    expect(source.utf16Offset(byte)).toBe(unit)
    expect(source.byteOffset(unit)).toBe(byte)
  }
  for (const byte of [-1, 1, 7, 15, 17, NaN, 0.5])
    expect(() => source.utf16Offset(byte)).toThrow()
  for (const unit of [-1, 3, 10, NaN, 0.5])
    expect(() => source.byteOffset(unit)).toThrow()
  expect(new SourceText('').byteOffset(0)).toBe(0)
  expect(new SourceText('').utf16Offset(0)).toBe(0)
})

test('source operations follow the shared cross-language byte contract', () => {
  for (const fixture of sourceFixtures) {
    const source = new SourceText(fixture.source)
    for (const slice of fixture.slices)
      expect(source.slice(slice), fixture.name).toBe(slice.text)
    for (const span of fixture.invalidSpans)
      expect(() => source.slice(span), fixture.name).toThrow()
    expect(
      source.replace(
        fixture.edits.map(({ start, end, text }) => ({
          span: { start, end },
          text
        }))
      ),
      fixture.name
    ).toBe(fixture.expected)
  }
})

test('source byte slicing and edits preserve BOM, Unicode, NUL and line endings', () => {
  const source = new SourceText('\uFEFF猫\r\n\0x\uFEFF')
  expect(source.slice({ start: 0, end: source.byteLength })).toBe(source.text)
  expect(source.slice({ start: 0, end: 3 })).toBe('\uFEFF')
  expect(source.slice({ start: 3, end: 6 })).toBe('猫')
  expect(source.slice({ start: 10, end: 13 })).toBe('\uFEFF')
  expect(source.replace([])).toBe(source.text)
  expect(source.replace([{ span: { start: 3, end: 6 }, text: '犬' }])).toBe(
    '\uFEFF犬\r\n\0x\uFEFF'
  )
  const bytes = source.bytes()
  bytes.fill(0)
  expect(source.slice({ start: 0, end: 3 })).toBe('\uFEFF')
})

test('source operations reject invalid UTF-8 boundaries and conflicting edits', () => {
  const source = new SourceText('猫x')
  for (const span of [
    { start: -1, end: 1 },
    { start: 1, end: 3 },
    { start: 0, end: 2 },
    { start: 0, end: 5 },
    { start: 3, end: 0 },
    { start: NaN, end: 0 }
  ])
    expect(() => source.slice(span)).toThrow(/span/)
  expect(() => new SourceText('\uD800')).toThrow(/unpaired surrogate/)
  expect(() =>
    source.replace([
      { span: { start: 0, end: 4 }, text: 'one' },
      { span: { start: 3, end: 4 }, text: 'two' }
    ])
  ).toThrow(/Overlapping or unordered/)
})

test('document contexts own snapshots without freezing or trusting mutable caller nodes', () => {
  const node = {
    kind: 'custom',
    span: { start: 0, end: 3 },
    data: { label: '猫' }
  }
  const original = { source: '猫', children: [node] }
  const context = new DocumentContext(original)
  const snapshot = context.node(node)
  node.data.label = 'changed'
  node.span.end = 0
  original.source = 'x'
  original.children.length = 0
  expect(snapshot.data).toEqual({ label: '猫' })
  expect(context.source.slice(snapshot.span)).toBe('猫')
  expect(context.document.children).toHaveLength(1)
  expect(Object.isFrozen(node)).toBe(false)
  expect(Object.isFrozen(snapshot.data)).toBe(true)
  expect(() => context.node({ ...node })).toThrow(/does not belong/)
})

test('document context validates the whole tree before a consumer can traverse it', () => {
  const node: MutableNode = {
    kind: 'custom',
    span: { start: 0, end: 0 },
    data: {},
    children: []
  }
  node.children!.push(node)
  expect(() => new DocumentContext({ source: '', children: [node] })).toThrow(
    /tree/
  )
  expect(() => new DocumentContext({} as never)).toThrow(/source/)
  expect(
    () => new DocumentContext({ source: '', children: [{}] } as never)
  ).toThrow(/node/)
  expect(
    () =>
      new DocumentContext({
        source: 'ab',
        children: [
          { kind: 'custom', span: { start: 0, end: 2 }, data: {} },
          { kind: 'custom', span: { start: 1, end: 2 }, data: {} }
        ]
      })
  ).toThrow(/span/)
})
