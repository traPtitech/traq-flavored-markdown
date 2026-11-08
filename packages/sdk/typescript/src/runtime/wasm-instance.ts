import { object } from '@traq-flavored-markdown/core/validation'

import { abiExports } from '../generated/abi.js'
import {
  contractId,
  documentLimits,
  inputBytes,
  outputBytes
} from '../generated/artifact.js'
import { MarkdownError } from './errors.js'

type Wasm = WebAssembly.Exports & { memory: WebAssembly.Memory }
type ExportFunction = (...args: number[]) => number
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const encoder = new TextEncoder()

/** Checked ABI calls and bounded memory access for one independently owned instance. */
export class WasmInstance {
  readonly #wasm: Wasm

  constructor(module: WebAssembly.Module) {
    const exports = new WebAssembly.Instance(module, {}).exports
    if (!(exports.memory instanceof WebAssembly.Memory)) {
      throw new Error('Missing Wasm memory')
    }

    for (const [name, signature] of Object.entries(abiExports)) {
      const fn = exports[name]
      if (typeof fn !== 'function' || fn.length !== signature.params.length) {
        throw new Error('Invalid Wasm export: ' + name)
      }
    }

    this.#wasm = exports as Wasm

    const contract = this.#readJSON(
      this.#invoke('contract_ptr'),
      this.#invoke('contract_len')
    )
    if (!matchesContract(contract)) {
      throw new MarkdownError({
        code: 'contract_mismatch',
        message: 'Wasm contract does not match this SDK'
      })
    }
  }

  call(
    name: string,
    source: string,
    byteLength: number,
    params: number[]
  ): unknown {
    const pointer = this.#invoke('input_ptr', byteLength)
    if (pointer === 0) throw new Error('Wasm rejected bounded input allocation')

    this.#memorySlice(pointer, byteLength).set(encoder.encode(source))
    const length = this.#invoke(name, ...params)
    return this.#readJSON(this.#invoke('output_ptr'), length)
  }

  #invoke(name: string, ...params: number[]): number {
    return (this.#wasm[name] as ExportFunction)(...params)
  }

  #memorySlice(pointer: number, length: number): Uint8Array {
    if (
      !Number.isInteger(pointer) ||
      pointer < 0 ||
      !Number.isInteger(length) ||
      length < 0 ||
      pointer + length > this.#wasm.memory.buffer.byteLength
    ) {
      throw new Error('Wasm memory range is invalid')
    }

    return new Uint8Array(this.#wasm.memory.buffer, pointer, length)
  }

  #readJSON(pointer: number, length: number): unknown {
    if (length <= 0 || length > outputBytes) {
      throw new Error('Wasm output length is invalid')
    }

    return JSON.parse(
      decoder.decode(this.#memorySlice(pointer, length))
    ) as unknown
  }
}

function matchesContract(value: unknown): boolean {
  if (
    !object(value) ||
    value.contractId !== contractId ||
    value.abiVersion !== 1 ||
    !object(value.limits)
  ) {
    return false
  }

  const limits = value.limits
  if (
    limits.inputBytes !== inputBytes ||
    limits.outputBytes !== outputBytes ||
    !object(limits.document)
  ) {
    return false
  }

  const document = limits.document

  return Object.entries(documentLimits).every(
    ([name, expected]) => document[name] === expected
  )
}
