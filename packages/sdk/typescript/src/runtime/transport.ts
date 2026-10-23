import { DocumentValidationError } from '@traq-flavored-markdown/core'
import type {
  DocumentContext,
  ReadonlyDocument
} from '@traq-flavored-markdown/core'
import {
  fields,
  object,
  string,
  utf8ByteLength
} from '@traq-flavored-markdown/core/validation'

import { abiExports, isWireError, operations } from '../generated/abi.js'
import {
  contractId,
  documentLimits,
  inputBytes,
  outputBytes
} from '../generated/artifact.js'
import { schema } from '../generated/nodes.js'
import { type Extraction, isExtraction } from '../generated/processing.js'
import { MarkdownError } from './errors.js'
import { encodeRequest } from './json.js'
import type {
  DocumentInput,
  ParsedDocument,
  ProcessedDocument
} from './types.js'

type OperationName = keyof typeof operations
type Results = {
  configuration: { contractId: string }
  document: ParsedDocument
  extraction: Extraction
  text: string
  processing: ProcessedDocument
}
type Result<N extends OperationName> = Results[(typeof operations)[N]['result']]
type Input<N extends OperationName> =
  (typeof operations)[N]['input'] extends 'text' ? string : unknown
type Params<N extends OperationName> =
  (typeof operations)[N]['params'] extends readonly ['i32'] ? [number] : []
type Wasm = WebAssembly.Exports & { memory: WebAssembly.Memory }
type ExportFunction = (...args: number[]) => number
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const encoder = new TextEncoder()
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

export interface Transport {
  call<N extends OperationName>(
    operation: N,
    input: Input<N>,
    ...params: Params<N>
  ): Result<N>
  dispose(): void
}

const isDocument = (value: unknown): value is ReadonlyDocument =>
  fields(value, { source: string, children: Array.isArray })

/** One independent Wasm instance, verified against the generated semantic contract. */
export function createTransport(
  module: WebAssembly.Module,
  onDispose: (transport: Transport) => void
): Transport {
  let wasm: Wasm | undefined
  const transport: Transport = Object.freeze({ call, dispose })
  try {
    const exports = new WebAssembly.Instance(module, {}).exports
    if (!(exports.memory instanceof WebAssembly.Memory))
      throw new Error('Missing Wasm memory')
    for (const [name, signature] of Object.entries(abiExports)) {
      const fn = exports[name]
      if (typeof fn !== 'function' || fn.length !== signature.params.length)
        throw new Error('Invalid Wasm export: ' + name)
    }
    wasm = exports as Wasm
    const contract = readJSON(invoke('contract_ptr'), invoke('contract_len'))
    if (
      !object(contract) ||
      contract.contractId !== contractId ||
      contract.abiVersion !== 1 ||
      !object(contract.limits) ||
      contract.limits.inputBytes !== inputBytes ||
      contract.limits.outputBytes !== outputBytes ||
      !object(contract.limits.document) ||
      Object.entries(documentLimits).some(
        ([name, value]) =>
          (contract.limits as { document: Record<string, unknown> }).document[
            name
          ] !== value
      )
    )
      throw new MarkdownError({
        code: 'contract_mismatch',
        message: 'Wasm contract does not match this SDK'
      })
  } catch (cause) {
    dispose()
    if (cause instanceof MarkdownError) throw cause
    throw new MarkdownError(
      {
        code: 'transport_error',
        message: 'Unable to instantiate Wasm transport'
      },
      undefined,
      cause
    )
  }
  return transport

  function dispose() {
    wasm = undefined
    onDispose(transport)
  }

  function invoke(name: string, ...params: number[]): number {
    return (wasm![name] as ExportFunction)(...params)
  }

  function memorySlice(pointer: number, length: number): Uint8Array {
    if (
      !Number.isInteger(pointer) ||
      pointer < 0 ||
      !Number.isInteger(length) ||
      length < 0 ||
      pointer + length > wasm!.memory.buffer.byteLength
    )
      throw new Error('Wasm memory range is invalid')
    return new Uint8Array(wasm!.memory.buffer, pointer, length)
  }

  function readJSON(pointer: number, length: number): unknown {
    if (length <= 0 || length > outputBytes)
      throw new Error('Wasm output length is invalid')
    return JSON.parse(decoder.decode(memorySlice(pointer, length))) as unknown
  }

  function call<N extends OperationName>(
    operation: N,
    input: Input<N>,
    ...params: Params<N>
  ): Result<N> {
    if (!wasm)
      throw new MarkdownError(
        { code: 'disposed', message: 'Instance is disposed' },
        operation
      )
    const descriptor = operations[operation]
    let source: string
    try {
      source =
        descriptor.input === 'text'
          ? (input as string)
          : operation === 'extract' || operation === 'render'
            ? encodeDocument(input)
            : encodeRequest(input, inputBytes)
      if (typeof source !== 'string')
        throw new TypeError('Expected a serializable request')
    } catch (cause) {
      if (cause instanceof MarkdownError) throw cause.withOperation(operation)
      if (cause instanceof DocumentValidationError)
        throw new MarkdownError(
          {
            code: cause.code,
            message: cause.message,
            path: cause.path,
            resource: cause.resource
          },
          operation,
          cause
        )
      throw new MarkdownError(
        { code: 'invalid_request', message: 'Invalid request input' },
        operation,
        cause
      )
    }
    const sourceInput = descriptor.input === 'text' && !descriptor.configuration
    const byteLimit = sourceInput ? documentLimits.sourceBytes : inputBytes
    const resource = sourceInput ? 'source_bytes' : 'input_bytes'
    if (source.length > byteLimit)
      throw new MarkdownError(
        {
          code: 'resource_limit',
          resource,
          message: resource + ' limit exceeded'
        },
        operation
      )
    let byteLength: number
    try {
      byteLength = utf8ByteLength(source)
    } catch (cause) {
      throw new MarkdownError(
        {
          code: 'invalid_utf8',
          message: 'Source contains an unpaired surrogate'
        },
        operation,
        cause
      )
    }
    if (byteLength > byteLimit)
      throw new MarkdownError(
        {
          code: 'resource_limit',
          resource,
          message: resource + ' limit exceeded'
        },
        operation
      )
    if (
      params.length !== descriptor.params.length ||
      params.some(
        value =>
          !Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff
      )
    )
      throw new MarkdownError(
        { code: 'invalid_request', message: 'Invalid operation arguments' },
        operation
      )

    let reply: unknown
    try {
      const pointer = invoke('input_ptr', byteLength)
      if (pointer === 0)
        throw new Error('Wasm rejected bounded input allocation')
      memorySlice(pointer, byteLength).set(encoder.encode(source))
      const length = invoke(descriptor.export, ...params)
      reply = readJSON(invoke('output_ptr'), length)
      if (
        !object(reply) ||
        Object.keys(reply).length !== 1 ||
        (!Object.hasOwn(reply, 'ok') && !Object.hasOwn(reply, 'error'))
      )
        throw new Error('Malformed Wasm reply envelope')
      if (Object.hasOwn(reply, 'error')) {
        if (!isWireError(reply.error)) throw new Error('Malformed Wasm error')
      } else {
        const value = reply.ok
        const valid =
          descriptor.result === 'configuration'
            ? fields(value, { contractId: string })
            : descriptor.result === 'document'
              ? isDocument(value)
              : descriptor.result === 'extraction'
                ? isExtraction(value)
                : descriptor.result === 'processing'
                  ? fields(value, {
                      document: isDocument,
                      extraction: isExtraction,
                      plainText: string
                    })
                  : typeof value === 'string'
        if (!valid) throw new Error('Malformed Wasm success value')
        if (descriptor.result === 'document')
          reply.ok = schema.document(value as ReadonlyDocument)
        else if (descriptor.result === 'processing') {
          const result = value as {
            document: ReadonlyDocument
            extraction: Extraction
            plainText: string
          }
          reply.ok = Object.freeze({
            ...result,
            document: schema.document(result.document)
          })
        }
      }
    } catch (cause) {
      dispose()
      throw new MarkdownError(
        { code: 'transport_error', message: 'Wasm transport failed' },
        operation,
        cause
      )
    }
    const envelope = reply as { ok?: unknown; error?: unknown }
    if (isWireError(envelope.error))
      throw new MarkdownError(envelope.error, operation)
    if (
      descriptor.configuration &&
      (envelope.ok as { contractId: string }).contractId !== contractId
    ) {
      dispose()
      throw new MarkdownError(
        {
          code: 'contract_mismatch',
          message: 'Wasm contract does not match this SDK'
        },
        operation
      )
    }
    // Only complete, schema-validated successes escape the transport boundary.
    return envelope.ok as Result<N>
  }
}
