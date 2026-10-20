import { expect, test } from 'bun:test'

import { MarkdownError } from '../../runtime/errors.js'
import { encodeRequest } from '../../runtime/json.js'

function error(value: unknown, limit = 1024): MarkdownError {
  try {
    encodeRequest(value, limit)
  } catch (cause) {
    expect(cause).toBeInstanceOf(MarkdownError)
    return cause as MarkdownError
  }
  throw new Error('Expected request encoding to fail')
}

test('bounded JSON preserves primitive escapes, Unicode and optional fields', () => {
  const input = {
    text: '\uFEFFé\r\n\u0000😀"\\',
    values: [null, true, false, -0, 1.5],
    absent: undefined,
    nested: { enabled: false }
  }
  const expected = JSON.stringify(input)
  const length = new TextEncoder().encode(expected).length
  expect(encodeRequest(input, length)).toBe(expected)
  expect(error(input, length - 1).resource).toBe('input_bytes')
  expect(encodeRequest(Object.assign(Object.create(null), { a: 1 }), 7)).toBe(
    '{"a":1}'
  )
})

test('JSON byte bounds account for encoded keys, controls and multibyte text', () => {
  for (const input of ['é', '😀', '\u0000', '\b\t\n\f\r', { '😀': 'é' }]) {
    const expected = JSON.stringify(input)
    const length = new TextEncoder().encode(expected).length
    expect(encodeRequest(input, length)).toBe(expected)
    expect(error(input, length - 1).code).toBe('resource_limit')
  }
  expect(encodeRequest([], 2)).toBe('[]')
  expect(encodeRequest([0], 3)).toBe('[0]')
  expect(error(new Array(1_000_000_000), 100).resource).toBe('input_bytes')
  expect(
    error(
      Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, undefined])),
      10
    ).resource
  ).toBe('request_values')
})

test('request encoding never invokes getters or toJSON hooks', () => {
  let calls = 0
  const accessor = Object.defineProperty({}, 'value', {
    enumerable: true,
    get() {
      calls++
      return 1
    }
  })
  const hook = {
    toJSON() {
      calls++
      return 1
    }
  }
  const array = Object.defineProperty([0], 0, {
    get() {
      calls++
      return 0
    }
  })
  for (const value of [accessor, hook, array])
    expect(error(value).code).toBe('invalid_request')
  expect(calls).toBe(0)
})

test('request encoding rejects invalid UTF-16 keys and values', () => {
  for (const input of [
    '\ud800',
    '\udc00',
    { '\ud800': 1 },
    { value: '\udc00' }
  ])
    expect(error(input).code).toBe('invalid_utf8')
})

test('request encoding bounds cycles and nesting without rejecting shared data', () => {
  const cycle: unknown[] = []
  cycle.push(cycle)
  expect(error(cycle).code).toBe('invalid_request')
  const shared = { a: 1 }
  expect(encodeRequest([shared, shared], 100)).toBe('[{"a":1},{"a":1}]')
  let deep: unknown = 0
  for (let index = 0; index < 300; index++) deep = [deep]
  expect(error(deep, 10000).resource).toBe('request_depth')
})

test('request encoding rejects values outside the JSON request domain', () => {
  for (const input of [
    undefined,
    Number.NaN,
    Infinity,
    1n,
    Symbol('value'),
    () => 1,
    new Date(),
    [undefined],
    new Array(1)
  ])
    expect(error(input).code).toBe('invalid_request')
})
