import { expect, test } from 'bun:test'

import { outputDiff } from './diff.ts'

test('detailed and coarse diffs preserve both full outputs', () => {
  for (const prefix of ['', 'prefix'.repeat(3000)]) {
    const before = prefix + 'before 😀\r\nend'
    const after = prefix + 'after 😃\r\nend'
    const diff = outputDiff(before, after)
    expect(diff.coarse).toBe(prefix.length > 0)
    expect(
      diff.parts
        .filter(([operation]) => operation !== 1)
        .map(([, value]) => value)
        .join('')
    ).toBe(before)
    expect(
      diff.parts
        .filter(([operation]) => operation !== -1)
        .map(([, value]) => value)
        .join('')
    ).toBe(after)
  }
})
