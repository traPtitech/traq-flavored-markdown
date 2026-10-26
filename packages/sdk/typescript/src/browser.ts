import { type Runtime, createRuntime } from './index.js'
import { MarkdownError } from './runtime/errors.js'

export {
  embedReferences,
  isGrammarPresetId,
  mentionsUser,
  presets,
  MarkdownError
} from './index.js'
export type {
  GrammarPresetId,
  MarkdownErrorCode,
  Parser,
  Extractor,
  PlainTextRenderer,
  Processor,
  ProcessedDocument
} from './index.js'

export type BrowserRuntime = Pick<
  Runtime,
  | 'createParser'
  | 'createExtractor'
  | 'createPlainTextRenderer'
  | 'createProcessor'
>

let loading: Promise<BrowserRuntime> | undefined

/** Loads the packaged Wasm once and keeps its Runtime alive for this page. */
export function loadRuntime(): Promise<BrowserRuntime> {
  return (loading ??= (async () => {
    const response = await fetch(new URL('./parser.wasm', import.meta.url))
    if (!response.ok)
      throw new MarkdownError(
        {
          code: 'transport_error',
          message: 'Unable to load Wasm: HTTP ' + response.status
        },
        'load'
      )

    const runtime = await createRuntime(
      new Uint8Array(await response.arrayBuffer())
    )

    const shared: BrowserRuntime = {
      createParser: runtime.createParser,
      createExtractor: runtime.createExtractor,
      createPlainTextRenderer: runtime.createPlainTextRenderer,
      createProcessor: runtime.createProcessor
    }

    return Object.freeze(shared)
  })().catch(error => {
    loading = undefined
    if (error instanceof MarkdownError) throw error
    throw new MarkdownError(
      { code: 'transport_error', message: 'Unable to load Wasm' },
      'load',
      error
    )
  }))
}
