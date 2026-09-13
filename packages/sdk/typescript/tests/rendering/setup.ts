import { createRuntime, presets } from '@traq-markdown-engine/sdk'
import { file } from 'bun'

export const wasmBytes = await file(
  new URL(import.meta.resolve('@traq-markdown-engine/sdk/parser.wasm'))
).bytes()
const runtime = await createRuntime(wasmBytes)
export const parser = runtime.createParser(presets.traq.v1)
export const commonParser = () => runtime.createParser(presets.commonmark)
