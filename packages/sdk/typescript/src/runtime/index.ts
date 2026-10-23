import type { GrammarPresetId } from '../generated/presets.js'
import type {
  ExtractorOptions,
  PlainTextOptions,
  ProcessorConfiguration,
  ProcessorOptions
} from '../generated/processing.js'
import { MarkdownError } from './errors.js'
import { type Transport, createTransport } from './transport.js'
import type {
  DocumentInput,
  Extractor,
  Parser,
  PlainTextRenderer,
  Processor,
  Runtime
} from './types.js'

export type {
  DocumentInput,
  Extractor,
  Parser,
  ParsedDocument,
  PlainTextRenderer,
  ProcessedDocument,
  Processor,
  Runtime
} from './types.js'

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
    createParser(preset: GrammarPresetId): Parser {
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
        extract: (document: DocumentInput) =>
          instance.call('extract', document),
        dispose: instance.dispose
      })
    },
    createPlainTextRenderer(options: PlainTextOptions = {}): PlainTextRenderer {
      const instance = instantiate('configureRenderer', options)
      return Object.freeze({
        render: (document: DocumentInput) => instance.call('render', document),
        dispose: instance.dispose
      })
    },
    createProcessor(
      preset: GrammarPresetId,
      options: ProcessorOptions = {}
    ): Processor {
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
    input: string | ExtractorOptions | PlainTextOptions | ProcessorConfiguration
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
