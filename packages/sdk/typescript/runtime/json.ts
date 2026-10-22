import { MarkdownError } from './errors.js'

const maximumDepth = 256

/** Encode bounded JSON without invoking accessors, toJSON, or coercion hooks. */
export function encodeRequest(value: unknown, byteLimit: number): string {
  if (!Number.isSafeInteger(byteLimit) || byteLimit < 0)
    invalid('Request byte limit must be a nonnegative safe integer')

  const chunks: string[] = []
  const active = new Set<object>()
  const workLimit = Math.min(byteLimit, 1_048_575) + 1
  let bytes = 0
  let work = 0

  write(value, 0)
  return chunks.join('')

  function reserve(length: number) {
    if (length > byteLimit - bytes)
      throw new MarkdownError({
        code: 'resource_limit',
        resource: 'input_bytes',
        message: 'input_bytes limit exceeded'
      })
    bytes += length
  }

  function token(text: string) {
    reserve(text.length)
    chunks.push(text)
  }

  function quoted(text: string) {
    // UTF-16 length is a lower bound on its quoted UTF-8 representation.
    if (text.length > byteLimit - bytes) reserve(text.length)
    let length = 2
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index)
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(++index)
        if (!(next >= 0xdc00 && next <= 0xdfff)) invalidUnicode()
        length += 4
      } else if (code >= 0xdc00 && code <= 0xdfff) invalidUnicode()
      else if (code === 0x22 || code === 0x5c) length += 2
      else if (code < 0x20) length += [8, 9, 10, 12, 13].includes(code) ? 2 : 6
      else length += code < 0x80 ? 1 : code < 0x800 ? 2 : 3
      if (length > byteLimit - bytes) reserve(length)
    }
    reserve(length)
    // Only a primitive reaches JSON.stringify; output allocation is now bounded.
    chunks.push(JSON.stringify(text))
  }

  function write(item: unknown, depth: number) {
    visit()
    if (item === null) return token('null')
    if (typeof item === 'string') return quoted(item)
    if (typeof item === 'boolean') return token(item ? 'true' : 'false')
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) invalid('Request numbers must be finite')
      return token(JSON.stringify(item))
    }
    if (typeof item !== 'object') invalid('Expected a JSON request value')
    if (depth >= maximumDepth)
      throw new MarkdownError({
        code: 'resource_limit',
        resource: 'request_depth',
        message: 'Request nesting limit exceeded'
      })
    if (active.has(item)) invalid('Request contains a cycle')
    const array = Array.isArray(item)
    const prototype: unknown = Object.getPrototypeOf(item)
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      invalid('Request objects must be plain JSON objects')
    active.add(item)
    if (array) {
      const length = item.length
      // Even an array of single-digit numbers needs at least two bytes per item.
      if (length > Math.floor((byteLimit - bytes) / 2))
        reserve(byteLimit - bytes + 1)
      token('[')
      for (let index = 0; index < length; index++) {
        if (index) token(',')
        write(data(item, String(index)), depth + 1)
      }
      token(']')
    } else {
      token('{')
      let first = true
      for (const key in item) {
        if (!Object.hasOwn(item, key)) continue
        visit()
        const entry = data(item, key)
        // Optional object fields follow ordinary JSON omission semantics.
        if (entry === undefined) continue
        if (!first) token(',')
        first = false
        quoted(key)
        token(':')
        write(entry, depth + 1)
      }
      token('}')
    }
    active.delete(item)
  }

  function visit() {
    if (++work > workLimit)
      throw new MarkdownError({
        code: 'resource_limit',
        resource: 'request_values',
        message: 'Request value limit exceeded'
      })
  }
}

function data(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !Object.hasOwn(descriptor, 'value'))
    invalid('Request fields must be own data properties')
  return descriptor.value as unknown
}

function invalid(message: string): never {
  throw new MarkdownError({ code: 'invalid_request', message })
}

function invalidUnicode(): never {
  throw new MarkdownError({
    code: 'invalid_utf8',
    message: 'Request contains an unpaired surrogate'
  })
}
