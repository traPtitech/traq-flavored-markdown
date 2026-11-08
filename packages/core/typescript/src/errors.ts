/** A document boundary failure, independent of any consumer or output format. */
export class DocumentValidationError extends TypeError {
  readonly code: 'invalid_document' | 'resource_limit'
  readonly path: string
  readonly resource: string | undefined

  constructor(
    message: string,
    {
      path = '$',
      resource,
      cause
    }: {
      path?: string | undefined
      resource?: string | undefined
      cause?: unknown
    } = {}
  ) {
    super(message, { cause })
    this.name = 'DocumentValidationError'
    this.code = resource ? 'resource_limit' : 'invalid_document'
    this.path = path
    this.resource = resource
  }
}
