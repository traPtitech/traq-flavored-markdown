import type { Document } from '../generated/nodes.js'
import type { Preset } from '../generated/presets.js'
import type {
  Extraction,
  ExtractorOptions,
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
  extract(document: Document): Extraction
  dispose(): void
}
export interface PlainTextRenderer {
  render(document: Document): string
  dispose(): void
}
export interface Runtime {
  createParser(preset: Preset): Parser
  createExtractor(options?: ExtractorOptions): Extractor
  createRenderer(options?: RendererOptions): PlainTextRenderer
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
        extract: (document: Document) => instance.call('extract', document),
        dispose: instance.dispose
      })
    },
    createRenderer(options: RendererOptions = {}): PlainTextRenderer {
      const instance = instantiate('configureRenderer', options)
      return Object.freeze({
        render: (document: Document) => instance.call('render', document),
        dispose: instance.dispose
      })
    },
    dispose() {
      module = undefined
      for (const instance of instances) instance.dispose()
    }
  })

  function instantiate(
    operation: 'configure' | 'configureExtractor' | 'configureRenderer',
    input: string | ExtractorOptions | RendererOptions
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
