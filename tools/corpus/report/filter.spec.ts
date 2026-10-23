import { expect, test } from 'bun:test'

import { fixtureRows } from '../testing/fixtures.ts'
import { isWhitespaceOnlyDifference } from './filter.ts'

test('whitespace filtering never hides errors or changes of output kind', () => {
  expect(isWhitespaceOnlyDifference(fixtureRows[0])).toBe(true)
  expect(isWhitespaceOnlyDifference(fixtureRows[1])).toBe(false)
  expect(
    isWhitespaceOnlyDifference({
      before: { kind: 'html', value: 'same' },
      after: { kind: 'text', value: 'same' }
    })
  ).toBe(false)
  expect(isWhitespaceOnlyDifference(fixtureRows[2])).toBe(false)
})
