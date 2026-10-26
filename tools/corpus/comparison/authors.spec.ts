import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { parseAuthorIndex, sourceAuthorKind } from '../protocol/authors.ts'
import { fixtureDigest, fixturePlan } from '../testing/fixtures.ts'
import { writeAuthorIndex } from './authors.ts'
import { validateAuthors } from './run-files.ts'

test('account metadata rejects coercion and distinguishes unknown from human', () => {
  expect(sourceAuthorKind({ source: 'BOT' })).toBe('u')
  expect(sourceAuthorKind({ isBot: false })).toBe('h')
  expect(sourceAuthorKind({ isBot: true })).toBe('b')
  for (const isBot of ['true', 'false', 0, 1, null])
    expect(() => sourceAuthorKind({ isBot })).toThrow('Invalid source isBot')
  const authors = {
    format: '1' as const,
    runId: 'synthetic-run',
    corpusSha256: fixtureDigest,
    kinds: 'bhu'
  }
  expect(parseAuthorIndex(authors).kinds).toBe('bhu')
  expect(() => parseAuthorIndex({ ...authors, kinds: 'bot' })).toThrow()
  expect(() => validateAuthors(fixturePlan(), authors, 2)).toThrow(
    'counts mismatch'
  )
  expect(() =>
    validateAuthors(fixturePlan(), { ...authors, runId: 'another' }, 3)
  ).toThrow('different comparison run')
  expect(() =>
    validateAuthors(
      fixturePlan(),
      { ...authors, corpusSha256: 'b'.repeat(64) },
      3
    )
  ).toThrow('different comparison run')
})

test('author index follows nonempty source rows and comparison bounds, independently of warmups', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-authors-'))
  try {
    const corpus = path.join(directory, 'input.jsonl')
    await Bun.write(
      corpus,
      '\r\n' +
        [
          { source: 'BOT says hello', isBot: false },
          { source: 'Hello', isBot: true },
          { source: 'BOT is not author information' },
          { source: 'outside max', isBot: 'invalid' }
        ]
          .map(row => JSON.stringify(row))
          .join('\r\n')
    )
    const result = await writeAuthorIndex(
      fixturePlan({ corpus, output: directory, max: 3, warmups: 2 })
    )
    expect(result.kinds).toBe('hbu')
    expect(JSON.stringify(result)).not.toContain('Hello')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
