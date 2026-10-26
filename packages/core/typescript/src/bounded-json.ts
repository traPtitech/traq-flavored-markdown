import {
  ByteBudget,
  dataField,
  jsonStringByteLength,
  utf8ByteLength
} from './boundary.js'

export type JsonFailure = 'data' | 'unicode' | 'bytes' | 'depth' | 'values'

/** Shared diagnostic for safe snapshots and transport serialization. */
export class JsonBoundaryError extends TypeError {
  constructor(
    message: string,
    readonly reason: JsonFailure,
    readonly path: string
  ) {
    super(message)
    this.name = 'JsonBoundaryError'
  }
}

export interface JsonBoundaryOptions {
  bytes: number
  depth: number
  values?: number
  /** Payload snapshots retain all fields; wire JSON omits optional undefined fields. */
  representation: 'payload' | 'wire'
}

/** One traversal owns JSON data, Unicode, cycle, depth, work, and allocation checks. */
export class JsonBoundary {
  readonly #budget: ByteBudget
  readonly #active = new Set<object>()
  readonly #options: JsonBoundaryOptions
  readonly #chunks: string[] = []
  #values = 0
  #path = '$'

  constructor(options: JsonBoundaryOptions) {
    for (const value of [
      options.bytes,
      options.depth,
      options.values ?? options.bytes + 1
    ])
      if (!Number.isSafeInteger(value) || value < 0)
        throw new JsonBoundaryError(
          'JSON limits must be nonnegative safe integers',
          'data',
          '$'
        )
    this.#options = { ...options }
    this.#budget = new ByteBudget(
      options.bytes,
      () =>
        new JsonBoundaryError('JSON byte limit exceeded', 'bytes', this.#path)
    )
  }

  /** Charge a node kind or another string belonging to the same payload budget. */
  string(value: string, path = '$'): string {
    this.#path = path
    if (value.length > this.#budget.remaining)
      this.#budget.reserve(value.length)
    let length: number
    try {
      length =
        this.#options.representation === 'wire'
          ? jsonStringByteLength(value)
          : utf8ByteLength(value)
    } catch {
      throw new JsonBoundaryError(
        'Text contains an unpaired surrogate',
        'unicode',
        path
      )
    }
    this.#budget.reserve(length)
    return value
  }

  /** Snapshot mode returns deeply frozen data; wire mode returns encoded JSON. */
  read(value: unknown, path = '$'): unknown {
    const result = this.#visit(value, path, 0)
    return this.#options.representation === 'wire'
      ? this.#chunks.join('')
      : result
  }

  #fail(message: string, reason: JsonFailure, path: string): never {
    throw new JsonBoundaryError(message, reason, path)
  }

  #work(path: string): void {
    if (++this.#values > (this.#options.values ?? this.#options.bytes + 1))
      this.#fail('JSON value limit exceeded', 'values', path)
  }

  #field(value: object, key: string, path: string): unknown {
    try {
      if (!Object.hasOwn(value, key))
        this.#fail('JSON fields must be own data properties', 'data', path)
      return dataField(value, key)
    } catch (cause) {
      if (cause instanceof JsonBoundaryError) throw cause
      this.#fail('JSON accessors are not supported', 'data', path)
    }
  }

  #token(text: string): void {
    this.#budget.reserve(text.length)
    this.#chunks.push(text)
  }

  #visit(value: unknown, path: string, depth: number): unknown {
    this.#path = path
    this.#work(path)
    const wire = this.#options.representation === 'wire'
    if (!wire) {
      if (depth > this.#options.depth)
        this.#fail('JSON nesting limit exceeded', 'depth', path)
      this.#budget.reserve(1)
    }
    if (typeof value === 'string') {
      this.string(value, path)
      if (wire) this.#chunks.push(JSON.stringify(value))
      return value
    }
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      if (wire) this.#token(JSON.stringify(value))
      return value
    }
    if (typeof value !== 'object')
      this.#fail('Expected a finite JSON data value', 'data', path)
    if (wire && depth >= this.#options.depth)
      this.#fail('JSON nesting limit exceeded', 'depth', path)
    if (this.#active.has(value))
      this.#fail('JSON data contains a cycle', 'data', path)
    const array = Array.isArray(value)
    const prototype: unknown = Object.getPrototypeOf(value)
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    )
      this.#fail('Expected a plain JSON object or array', 'data', path)
    this.#active.add(value)
    try {
      if (array) {
        const length = value.length
        // Reject sparse or enormous arrays before inspecting or allocating their elements.
        if (wire) {
          if (length > Math.floor(this.#budget.remaining / 2))
            this.#budget.reserve(this.#budget.remaining + 1)
          this.#token('[')
        } else this.#budget.reserve(length)
        const copy: unknown[] = []
        for (let index = 0; index < length; index++) {
          if (wire && index) this.#token(',')
          const itemPath = `${path}[${index}]`
          const item = this.#visit(
            this.#field(value, String(index), itemPath),
            itemPath,
            depth + 1
          )
          if (!wire) copy.push(item)
        }
        if (wire) this.#token(']')
        return wire ? undefined : Object.freeze(copy)
      }
      if (wire) this.#token('{')
      const copy: Record<string, unknown> = {}
      let first = true
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue
        const label = key.length > 80 ? key.slice(0, 80) + '…' : key
        const fieldPath = `${path}[${JSON.stringify(label)}]`
        this.#work(fieldPath)
        const field = this.#field(value, key, fieldPath)
        if (wire && field === undefined) continue
        if (wire && !first) this.#token(',')
        first = false
        this.string(key, fieldPath)
        if (wire) {
          this.#chunks.push(JSON.stringify(key))
          this.#token(':')
        }
        const item = this.#visit(field, fieldPath, depth + 1)
        if (!wire)
          Object.defineProperty(copy, key, { value: item, enumerable: true })
      }
      if (wire) this.#token('}')
      return wire ? undefined : Object.freeze(copy)
    } finally {
      this.#active.delete(value)
    }
  }
}
