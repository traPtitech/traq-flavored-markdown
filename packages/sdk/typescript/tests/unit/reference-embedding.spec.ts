import { expect, test } from 'bun:test'

import type { ReferenceEmbeddingCandidate } from '../../src/generated/processing.js'
import { embedReferences } from '../../src/traq/messages/reference-embedding.js'

const candidate: ReferenceEmbeddingCandidate = {
  start: 8,
  end: 10,
  raw: '@a',
  name: 'a',
  kind: 'user'
}
const source = '\uFEFF😀 @a\r\n\0'
const plan = (candidates: ReferenceEmbeddingCandidate[]) => ({
  candidates,
  unembeddedText: source
})

test('reference edits preserve all original bytes outside validated candidates', () => {
  expect(embedReferences(source, plan([]), () => undefined)).toBe(source)
  expect(embedReferences(source, plan([candidate]), () => 'id')).toBe(
    '\uFEFF😀 !{"type":"user","raw":"@a","id":"id"}\r\n\0'
  )
  expect(embedReferences(source, plan([candidate]), () => undefined)).toBe(
    source
  )
  expect(() =>
    embedReferences(source, plan([candidate]), () => '\ud800')
  ).toThrow(/surrogate/)
})

test('all candidates are validated before any resolver, including overlapping alternatives', () => {
  let calls = 0
  const resolve = () => {
    calls++
    return 'id'
  }
  for (const bad of [
    { ...candidate, start: 1 },
    { ...candidate, raw: '@other' },
    { ...candidate, name: '\ud800' },
    { ...candidate, kind: 'other' as never }
  ])
    expect(() =>
      embedReferences(source, plan([candidate, bad]), resolve)
    ).toThrow(/does not match source/)
  expect(calls).toBe(0)
  const tried: string[] = []
  const alternatives = [candidate, { ...candidate, kind: 'group' as const }]
  expect(
    embedReferences(source, plan(alternatives), kind => {
      tried.push(kind)
      return kind === 'group' ? 'id' : undefined
    })
  ).toContain('"type":"group"')
  expect(tried).toEqual(['user', 'group'])
  tried.length = 0
  embedReferences(source, plan(alternatives), kind => {
    tried.push(kind)
    return 'id'
  })
  expect(tried).toEqual(['user'])
})

test('resolvers operate on the validated plan even if they mutate the caller copy', () => {
  const source = '@a @b'
  const second = {
    kind: 'user' as const,
    start: 3,
    end: 5,
    raw: '@b',
    name: 'b'
  }
  const input = {
    candidates: [{ ...second, start: 0, end: 2, raw: '@a', name: 'a' }, second],
    unembeddedText: source
  }
  const seen: string[] = []
  const output = embedReferences(source, input, (_kind, name) => {
    seen.push(name)
    second.name = 'changed'
    second.end = 1000
    input.candidates.length = 1
    return name
  })
  expect(seen).toEqual(['a', 'b'])
  expect(output).toBe(
    '!{"type":"user","raw":"@a","id":"a"} !{"type":"user","raw":"@b","id":"b"}'
  )
})
