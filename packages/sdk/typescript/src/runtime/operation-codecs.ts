import type {
  DocumentContext,
  ReadonlyDocument
} from '@traq-flavored-markdown/core'
import { fields, object, string } from '@traq-flavored-markdown/core/validation'

import type { operations } from '../generated/abi.js'
import { type WireError, isWireError } from '../generated/abi.js'
import { contractId, inputBytes } from '../generated/artifact.js'
import { schema } from '../generated/nodes.js'
import { type Extraction, isExtraction } from '../generated/processing.js'
import { MarkdownError } from './errors.js'
import { encodeRequest } from './json.js'
import { bindSyntax } from './syntax.js'
import type {
  DocumentInput,
  ParsedDocument,
  ParsedSyntax,
  ProcessedDocument
} from './types.js'

export type OperationName = keyof typeof operations

type Results = {
  configuration: { contractId: string }
  document: ParsedDocument
  extraction: Extraction
  text: string
  processing: ProcessedDocument
  syntax: ParsedSyntax
}

export type OperationResult<N extends OperationName> =
  Results[(typeof operations)[N]['result']]

export type OperationInput<N extends OperationName> =
  (typeof operations)[N]['input'] extends 'text' ? string : unknown

export type OperationParams<N extends OperationName> =
  (typeof operations)[N]['params'] extends readonly ['i32'] ? [number] : []

type OperationCodec<N extends OperationName> = {
  encode(input: OperationInput<N>): string
  decode(value: unknown): OperationResult<N>
}

const inputSchema = schema.withUnknownNodes()
const documentRequests = new WeakMap<DocumentContext, string>()

function encodeDocument(input: unknown): string {
  const context = inputSchema.document(input as DocumentInput)
  const cached = documentRequests.get(context)
  if (cached !== undefined) return cached

  const encoded = encodeRequest(context.document, inputBytes)
  documentRequests.set(context, encoded)
  return encoded
}

function textInput(input: unknown): string {
  if (typeof input !== 'string') throw new TypeError('Expected a text request')
  return input
}

const jsonInput = (input: unknown) => encodeRequest(input, inputBytes)

const isDocument = (value: unknown): value is ReadonlyDocument =>
  fields(value, { source: string, children: Array.isArray })

function malformed(): never {
  throw new Error('Malformed Wasm success value')
}

const resultCodecs: { [K in keyof Results]: (value: unknown) => Results[K] } = {
  configuration(value) {
    if (!fields(value, { contractId: string })) malformed()

    if (value.contractId !== contractId) {
      throw new MarkdownError({
        code: 'contract_mismatch',
        message: 'Wasm contract does not match this SDK'
      })
    }

    return value
  },

  document(value) {
    if (!isDocument(value)) malformed()
    return schema.document(value)
  },

  syntax(value) {
    if (!fields(value, { document: isDocument, syntax: object })) malformed()
    return bindSyntax(schema.document(value.document), value.syntax)
  },

  extraction(value) {
    if (!isExtraction(value)) malformed()
    return value
  },

  processing(value) {
    if (
      !fields(value, {
        document: isDocument,
        extraction: isExtraction,
        plainText: string
      })
    ) {
      malformed()
    }

    return Object.freeze({
      ...value,
      document: schema.document(value.document)
    })
  },

  text(value) {
    if (typeof value !== 'string') malformed()
    return value
  }
}

/** Generated operation descriptors determine the input and decoded result of each entry. */
export const operationCodecs: { [N in OperationName]: OperationCodec<N> } = {
  configure: { encode: textInput, decode: resultCodecs.configuration },
  configureExtractor: { encode: jsonInput, decode: resultCodecs.configuration },
  configureProcessor: { encode: jsonInput, decode: resultCodecs.configuration },
  configureRenderer: { encode: jsonInput, decode: resultCodecs.configuration },
  parse: { encode: textInput, decode: resultCodecs.document },
  parseWithSyntax: { encode: textInput, decode: resultCodecs.syntax },
  extract: { encode: encodeDocument, decode: resultCodecs.extraction },
  render: { encode: encodeDocument, decode: resultCodecs.text },
  process: { encode: textInput, decode: resultCodecs.processing }
}

export function decodeReply<N extends OperationName>(
  operation: N,
  reply: unknown
): { ok: OperationResult<N> } | { error: WireError } {
  if (!object(reply) || Object.keys(reply).length !== 1) {
    throw new Error('Malformed Wasm reply envelope')
  }

  if (Object.hasOwn(reply, 'error')) {
    if (!isWireError(reply.error)) throw new Error('Malformed Wasm error')
    return { error: reply.error }
  }

  if (!Object.hasOwn(reply, 'ok')) {
    throw new Error('Malformed Wasm reply envelope')
  }

  return { ok: operationCodecs[operation].decode(reply.ok) }
}
