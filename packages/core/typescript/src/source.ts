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
