import {
  JsonBoundaryError,
  encodeJson
} from '@traq-flavored-markdown/core/validation'

import { MarkdownError } from './errors.js'

const requestLimits = Object.freeze({ depth: 256, values: 1_048_576 })

/** The host boundary selects wire semantics and maps shared diagnostics to SDK errors. */
export function encodeRequest(value: unknown, byteLimit: number): string {
  try {
    return encodeJson(value, {
      bytes: byteLimit,
      depth: requestLimits.depth,
      values: Math.min(byteLimit + 1, requestLimits.values)
    })
  } catch (cause) {
    if (!(cause instanceof JsonBoundaryError)) throw cause

    const resource = {
      bytes: 'input_bytes',
      depth: 'request_depth',
      values: 'request_values'
    }[cause.reason as 'bytes' | 'depth' | 'values']

    throw new MarkdownError(
      {
        code: resource
          ? 'resource_limit'
          : cause.reason === 'unicode'
            ? 'invalid_utf8'
            : 'invalid_request',
        message: cause.message,
        path: cause.path,
        ...(resource ? { resource } : {})
      },
      undefined,
      cause
    )
  }
}
