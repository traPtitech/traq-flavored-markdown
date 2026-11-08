import { DocumentValidationError } from '@traq-flavored-markdown/core'
import { utf8ByteLength } from '@traq-flavored-markdown/core/validation'

import { operations } from '../generated/abi.js'
import { documentLimits, inputBytes } from '../generated/artifact.js'
import { MarkdownError } from './errors.js'
import {
  type OperationInput,
  type OperationName,
  type OperationParams,
  type OperationResult,
  decodeReply,
  operationCodecs
} from './operation-codecs.js'
import { WasmInstance } from './wasm-instance.js'

export interface Transport {
  call<N extends OperationName>(
    operation: N,
    input: OperationInput<N>,
    ...params: OperationParams<N>
  ): OperationResult<N>
  dispose(): void
}

/** Request failures preserve the instance; invalid replies and traps close it. */
export function createTransport(
  module: WebAssembly.Module,
  onDispose: (transport: Transport) => void
): Transport {
  let wasm: WasmInstance | undefined
  let disposed = false
  const transport: Transport = Object.freeze({ call, dispose })

  try {
    wasm = new WasmInstance(module)
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
    if (disposed) return
    disposed = true
    wasm = undefined
    onDispose(transport)
  }

  function call<N extends OperationName>(
    operation: N,
    input: OperationInput<N>,
    ...params: OperationParams<N>
  ): OperationResult<N> {
    if (!wasm) {
      throw new MarkdownError(
        { code: 'disposed', message: 'Instance is disposed' },
        operation
      )
    }

    const descriptor = operations[operation]
    let source: string

    try {
      source = operationCodecs[operation].encode(input)
    } catch (cause) {
      if (cause instanceof MarkdownError) throw cause.withOperation(operation)

      if (cause instanceof DocumentValidationError) {
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
      }

      throw new MarkdownError(
        { code: 'invalid_request', message: 'Invalid request input' },
        operation,
        cause
      )
    }

    const sourceInput = descriptor.input === 'text' && !descriptor.configuration
    const byteLimit = sourceInput ? documentLimits.sourceBytes : inputBytes
    const resource = sourceInput ? 'source_bytes' : 'input_bytes'

    if (source.length > byteLimit) {
      throw new MarkdownError(
        {
          code: 'resource_limit',
          resource,
          message: resource + ' limit exceeded'
        },
        operation
      )
    }

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

    if (byteLength > byteLimit) {
      throw new MarkdownError(
        {
          code: 'resource_limit',
          resource,
          message: resource + ' limit exceeded'
        },
        operation
      )
    }

    if (
      params.length !== descriptor.params.length ||
      params.some(
        value =>
          !Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff
      )
    ) {
      throw new MarkdownError(
        { code: 'invalid_request', message: 'Invalid operation arguments' },
        operation
      )
    }

    let reply: ReturnType<typeof decodeReply<N>>

    try {
      reply = decodeReply(
        operation,
        wasm.call(descriptor.export, source, byteLength, params)
      )
    } catch (cause) {
      dispose()

      if (
        cause instanceof MarkdownError &&
        cause.code === 'contract_mismatch'
      ) {
        throw cause.withOperation(operation)
      }

      throw new MarkdownError(
        { code: 'transport_error', message: 'Wasm transport failed' },
        operation,
        cause
      )
    }

    if ('error' in reply) throw new MarkdownError(reply.error, operation)
    return reply.ok
  }
}
