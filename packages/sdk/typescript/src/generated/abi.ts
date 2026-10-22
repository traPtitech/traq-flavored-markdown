import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from the Rust ABI contract. Do not edit.
export type WireError = {
  code: ErrorCode
  message: string
  offset?: number | null
  path?: string | null
  payload_type?: string | null
  phase?: ParsePhase | null
  resource?: string | null
  rule?: string | null
  span?: ErrorSpan | null
}
export type ErrorCode =
  | 'invalid_utf8'
  | 'invalid_request'
  | 'invalid_document'
  | 'unknown_preset'
  | 'invalid_mode'
  | 'not_configured'
  | 'resource_limit'
  | 'internal_error'
export type ErrorSpan = {
  end: number
  start: number
}
export type ParsePhase = 'block' | 'inline' | 'text'

function validateWireError(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      { code: validateErrorCode, message: string },
      {
        offset: nullable(
          (value: unknown) =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 4294967295
        ),
        path: nullable(string),
        payload_type: nullable(string),
        phase: nullable(validateParsePhase),
        resource: nullable(string),
        rule: nullable(string),
        span: nullable(validateErrorSpan)
      }
    ))(value)
}
function validateErrorCode(value: unknown): boolean {
  return oneOf(
    'invalid_utf8',
    'invalid_request',
    'invalid_document',
    'unknown_preset',
    'invalid_mode',
    'not_configured',
    'resource_limit',
    'internal_error'
  )(value)
}
function validateErrorSpan(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        end: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 4294967295,
        start: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 4294967295
      },
      {}
    ))(value)
}
function validateParsePhase(value: unknown): boolean {
  return oneOf('block', 'inline', 'text')(value)
}

export const isWireError = (value: unknown): value is WireError =>
  validateWireError(value)
export const operations = Object.freeze({
  configure: {
    export: 'configure',
    input: 'text',
    params: [],
    result: 'configuration',
    configuration: true
  },
  configureExtractor: {
    export: 'configure_extractor',
    input: 'json',
    params: [],
    result: 'configuration',
    configuration: true
  },
  configureProcessor: {
    export: 'configure_processor',
    input: 'json',
    params: [],
    result: 'configuration',
    configuration: true
  },
  configureRenderer: {
    export: 'configure_renderer',
    input: 'json',
    params: [],
    result: 'configuration',
    configuration: true
  },
  extract: {
    export: 'extract',
    input: 'json',
    params: [],
    result: 'extraction',
    configuration: false
  },
  parse: {
    export: 'parse',
    input: 'text',
    params: ['i32'],
    result: 'document',
    configuration: false
  },
  process: {
    export: 'process',
    input: 'text',
    params: ['i32'],
    result: 'processing',
    configuration: false
  },
  render: {
    export: 'render',
    input: 'json',
    params: [],
    result: 'text',
    configuration: false
  }
} as const)
export const abiExports = Object.freeze({
  configure: { params: [], results: ['i32'] },
  configure_extractor: { params: [], results: ['i32'] },
  configure_processor: { params: [], results: ['i32'] },
  configure_renderer: { params: [], results: ['i32'] },
  contract_len: { params: [], results: ['i32'] },
  contract_ptr: { params: [], results: ['i32'] },
  extract: { params: [], results: ['i32'] },
  input_ptr: { params: ['i32'], results: ['i32'] },
  output_ptr: { params: [], results: ['i32'] },
  parse: { params: ['i32'], results: ['i32'] },
  process: { params: ['i32'], results: ['i32'] },
  render: { params: [], results: ['i32'] }
} as const)
