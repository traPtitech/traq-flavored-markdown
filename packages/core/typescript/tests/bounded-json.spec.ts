import { expect, test } from 'bun:test'

import {
  JsonBoundaryError,
  JsonSnapshot,
  encodeJson
} from '../src/validation.js'

test('wire encodings own independent budgets and return one complete value', () => {
  const limits = { bytes: 7, depth: 3 }
  expect(encodeJson({ a: 1 }, limits)).toBe('{"a":1}')

  expect(() => encodeJson({ value: 'too long' }, limits)).toThrow(
    JsonBoundaryError
  )

  expect(encodeJson({ b: 2 }, limits)).toBe('{"b":2}')
})

test('payload snapshots preserve cumulative budgets and own nested values', () => {
  const snapshots = new JsonSnapshot({ bytes: 12, depth: 3 })
  const input = { value: ['a'] }
  const value = snapshots.snapshot(input)
  input.value[0] = 'changed'
  expect(value).toEqual({ value: ['a'] })
  expect(Object.isFrozen(value)).toBe(true)
  expect(() => snapshots.snapshot('more')).toThrow(JsonBoundaryError)
})

test('bounded encoding roundtrips composed JSON data', () => {
  const values = [
    null,
    true,
    false,
    0,
    -1.5,
    '',
    '\0\r\n',
    '日😀',
    { optional: undefined, value: '\\"' }
  ]

  for (const left of values) {
    for (const right of values) {
      const value = { pair: [left, right] }
      const encoded = encodeJson(value, { bytes: 1024, depth: 8 })
      expect(JSON.parse(encoded)).toEqual(JSON.parse(JSON.stringify(value)))
    }
  }
})
