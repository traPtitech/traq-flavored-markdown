import type { Span } from './ast.js'
import { utf8ByteLength } from './boundary.js'

export interface SourceEdit {
  span: Span
  text: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Original text addressed by UTF-8 bytes. Decoding always preserves BOM characters. */
export class SourceText {
  readonly text: string
  readonly byteLength: number
  #bytes: Uint8Array
  #offsets?: { bytes: Int32Array; utf16: Int32Array }

  constructor(text: string) {
    if (typeof text !== 'string') throw new TypeError('Expected source string')
    utf8ByteLength(text)
    this.#bytes = encoder.encode(text)
    this.text = text
    this.byteLength = this.#bytes.length
    Object.freeze(this)
  }

  isBoundary(offset: number): boolean {
    return (
      Number.isSafeInteger(offset) &&
      offset >= 0 &&
      offset <= this.byteLength &&
      (offset === this.byteLength || (this.#bytes[offset] & 0xc0) !== 0x80)
    )
  }

  assertSpan(span: Span): void {
    if (
      !span ||
      span.end < span.start ||
      !this.isBoundary(span.start) ||
      !this.isBoundary(span.end)
    )
      throw new TypeError('Invalid source UTF-8 span')
  }

  slice(span: Span): string {
    this.assertSpan(span)
    return decoder.decode(this.#bytes.subarray(span.start, span.end))
  }

  /** A copy for transport; callers cannot mutate this source's backing bytes. */
  bytes(): Uint8Array {
    return this.#bytes.slice()
  }

  /** Convert an original UTF-8 byte boundary to a JavaScript string offset. */
  utf16Offset(byteOffset: number): number {
    if (!this.isBoundary(byteOffset))
      throw new TypeError('Invalid source UTF-8 offset')
    return this.offsets().bytes[byteOffset]
  }

  /** Convert a JavaScript offset, rejecting positions inside surrogate pairs. */
  byteOffset(utf16Offset: number): number {
    if (
      !Number.isSafeInteger(utf16Offset) ||
      utf16Offset < 0 ||
      utf16Offset > this.text.length
    )
      throw new TypeError('Invalid source UTF-16 offset')
    const result = this.offsets().utf16[utf16Offset]
    if (result < 0) throw new TypeError('Invalid source UTF-16 boundary')
    return result
  }

  private offsets() {
    if (this.#offsets) return this.#offsets
    const bytes = new Int32Array(this.byteLength + 1).fill(-1)
    const utf16 = new Int32Array(this.text.length + 1).fill(-1)
    let byte = 0
    let unit = 0
    bytes[0] = 0
    utf16[0] = 0
    for (const character of this.text) {
      const code = character.codePointAt(0)!
      byte += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
      unit += character.length
      bytes[byte] = unit
      utf16[unit] = byte
    }
    return (this.#offsets = { bytes, utf16 })
  }

  /** Apply ordered, disjoint byte edits while preserving all other source bytes. */
  replace(edits: Iterable<SourceEdit>): string {
    let position = 0
    const output: string[] = []
    for (const { span, text } of edits) {
      this.assertSpan(span)
      if (span.start < position)
        throw new TypeError('Overlapping or unordered source edits')
      if (typeof text !== 'string')
        throw new TypeError('Invalid replacement text')
      utf8ByteLength(text)
      output.push(this.slice({ start: position, end: span.start }), text)
      position = span.end
    }
    output.push(this.slice({ start: position, end: this.byteLength }))
    return output.join('')
  }
}
