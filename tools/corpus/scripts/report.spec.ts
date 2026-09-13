import { expect, test } from 'bun:test'

import { ignoreMask } from './ignore-differences.ts'

test('corpus report filters whitespace-only differences', () => {
  expect(ignoreMask({ before: 'a \nb', after: 'ab' })).toBe(1)
  expect(ignoreMask({ before: 'a', after: 'b' })).toBe(0)
})
