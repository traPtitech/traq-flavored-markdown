import type { ErrorCode, WireError } from '../generated/abi.js'

export type MarkdownErrorCode =
  ErrorCode | 'disposed' | 'transport_error' | 'contract_mismatch'

/** A request error leaves its instance usable; transport errors dispose it. */
export class MarkdownError extends Error {
  readonly #detail: Omit<WireError, 'code'> & { code: MarkdownErrorCode }
  readonly code: MarkdownErrorCode
  readonly operation?: string
  readonly resource?: string
  readonly path?: string
  readonly offset?: number
  readonly span?: Readonly<{ start: number; end: number }>

  constructor(
    detail: Omit<WireError, 'code'> & { code: MarkdownErrorCode },
    operation?: string,
    cause?: unknown
  ) {
    super('Markdown: ' + detail.message, { cause: cause ?? detail })
    this.name = 'MarkdownError'
    this.code = detail.code
    this.operation = operation
    this.resource = detail.resource ?? undefined
    this.path = detail.path ?? undefined
    this.offset = detail.offset ?? undefined
    this.span = detail.span ? Object.freeze({ ...detail.span }) : undefined
    this.#detail = Object.freeze({ ...detail, span: this.span })
  }

  withOperation(operation: string): MarkdownError {
    return new MarkdownError(this.#detail, operation, this)
  }
}
