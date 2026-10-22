import type { ReadonlyDocument } from '@traq-flavored-markdown/core'
import type { Document } from '../generated/nodes.js'
import type { Preset } from '../generated/presets.js'
import type {
  Extraction,
  ExtractorOptions,
  ProcessingResult,
  ProcessorOptions,
  ProcessorConfiguration,
  RendererOptions
} from '../generated/processing.js'
import { MarkdownError } from './errors.js'
import { type Transport, createTransport } from './transport.js'

export interface Parser {
  parse(source: string): Document
  parseInline(source: string): Document
  dispose(): void
}
export interface Extractor {
  extract(document: ReadonlyDocument): Extraction
  dispose(): void
}
export interface PlainTextRenderer {
  render(document: ReadonlyDocument): string
  dispose(): void
}
export interface ProcessedDocument extends ProcessingResult {
  document: Document
}
export interface Processor {
  process(source: string): ProcessedDocument
  processInline(source: string): ProcessedDocument
  dispose(): void
}
export interface Runtime {
  createParser(preset: Preset): Parser
  createExtractor(options?: ExtractorOptions): Extractor
  createPlainTextRenderer(options?: RendererOptions): PlainTextRenderer
  createProcessor(preset: Preset, options?: ProcessorOptions): Processor
  dispose(): void
}

/** Compile once; each configured processor owns an independent Wasm instance. */
export async function createRuntime(bytes: Uint8Array): Promise<Runtime> {
  let module: WebAssembly.Module | undefined
  try {
    module = await WebAssembly.compile(new Uint8Array(bytes).buffer)
  } catch (cause) {
    throw new MarkdownError(
      { code: 'transport_error', message: 'Unable to compile Wasm' },
      undefined,
      cause
    )
  }
  const instances = new Set<Transport>()
  return Object.freeze({
    createParser(preset: Preset): Parser {
      const instance = instantiate('configure', preset)
      return Object.freeze({
        parse: (source: string) => instance.call('parse', source, 0),
        parseInline: (source: string) => instance.call('parse', source, 1),
        dispose: instance.dispose
      })
    },
    createExtractor(options: ExtractorOptions = {}): Extractor {
      const instance = instantiate('configureExtractor', options)
      return Object.freeze({
        extract: (document: ReadonlyDocument) => instance.call('extract', document),
        dispose: instance.dispose
      })
    },
    createPlainTextRenderer(options: RendererOptions = {}): PlainTextRenderer {
      const instance = instantiate('configureRenderer', options)
      return Object.freeze({
        render: (document: ReadonlyDocument) => instance.call('render', document),
        dispose: instance.dispose
      })
    },
    createProcessor(preset: Preset, options: ProcessorOptions = {}): Processor {
      const instance = instantiate('configureProcessor', { preset, options })
      return Object.freeze({
        process: (source: string) => instance.call('process', source, 0),
        processInline: (source: string) => instance.call('process', source, 1),
        dispose: instance.dispose
      })
    },
    dispose() {
      module = undefined
      for (const instance of instances) instance.dispose()
    }
  })

  function instantiate(
    operation:
      | 'configure'
      | 'configureExtractor'
      | 'configureRenderer'
      | 'configureProcessor',
    input:
      | string
      | ExtractorOptions
      | RendererOptions
      | ProcessorConfiguration
  ): Transport {
    if (!module)
      throw new MarkdownError(
        { code: 'disposed', message: 'Runtime is disposed' },
        operation
      )
    const instance = createTransport(module, closed => instances.delete(closed))
    try {
      instance.call(operation, input)
    } catch (error) {
      instance.dispose()
      throw error
    }
    instances.add(instance)
    return instance
  }
}
