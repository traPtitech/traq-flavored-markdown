/** Read plain data without invoking getters or serialization hooks. */
export function dataField(value: object, key: string): unknown {
  const field = Object.getOwnPropertyDescriptor(value, key)
  if (field && !('value' in field))
    throw new TypeError('JSON accessors are not supported')
  return field?.value
}

/** Measure valid Unicode text without allocating an encoded copy. */
export function utf8ByteLength(value: string): number {
  if (typeof value !== 'string') throw new TypeError('Expected text string')
  let bytes = 0
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError('Text contains an unpaired surrogate')
      bytes += 4
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new TypeError('Text contains an unpaired surrogate')
    } else bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3
  }
  return bytes
}

/** JSON quoting adds only ASCII escapes to the validated UTF-8 text. */
export function jsonStringByteLength(value: string): number {
  let bytes = 2 + utf8ByteLength(value)
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    if (unit === 0x22 || unit === 0x5c) bytes++
    else if (unit < 0x20) bytes += [8, 9, 10, 12, 13].includes(unit) ? 1 : 5
  }
  return bytes
}

/** Shared accounting; each boundary selects its own diagnostic. */
export class ByteBudget {
  #used = 0
  constructor(
    readonly limit: number,
    private readonly exceeded: () => Error
  ) {}

  get remaining(): number {
    return this.limit - this.#used
  }

  reserve(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > this.remaining)
      throw this.exceeded()
    this.#used += bytes
  }
}
