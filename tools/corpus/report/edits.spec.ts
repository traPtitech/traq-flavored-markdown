import { expect, test } from 'bun:test'

import { applyHtmlEdits } from './edits.ts'

test('HTML edits preserve untouched source and reject conflicting or invalid plans', () => {
  const edits = [
    { start: 3, end: 4, value: '' },
    { start: 0, end: 1, value: 'A' }
  ]

  expect(applyHtmlEdits('abcd', edits)).toBe('Abc')
  expect(edits[0].start).toBe(3)

  for (const invalid of [
    [{ start: -1, end: 0, value: '' }],
    [{ start: 1, end: 5, value: '' }],
    [{ start: 2, end: 1, value: '' }],
    [{ start: 0.5, end: 1, value: '' }],
    [
      { start: 0, end: 3, value: '' },
      { start: 2, end: 4, value: '' }
    ]
  ]) {
    expect(applyHtmlEdits('abcd', invalid)).toBeUndefined()
  }
})
