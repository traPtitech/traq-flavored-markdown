import { type Runtime, createRuntime } from './index.js'

export { embedReferences, isPreset, mentionsUser, presets } from './index.js'
export type { Preset } from './index.js'

export type BrowserRuntime = Pick<Runtime, 'createParser' | 'createExtractor'>

let loading: Promise<BrowserRuntime> | undefined

/** Loads the packaged Wasm once and keeps its Runtime alive for this page. */
export function loadRuntime(): Promise<BrowserRuntime> {
  return (loading ??= (async () => {
    const response = await fetch(new URL('./parser.wasm', import.meta.url))
    if (!response.ok) throw new Error('Failed to load Markdown parser')

    const runtime = await createRuntime(
      new Uint8Array(await response.arrayBuffer())
    )

    const shared: BrowserRuntime = {
      createParser: runtime.createParser,
      createExtractor: runtime.createExtractor
    }

    return Object.freeze(shared)
  })().catch(error => {
    loading = undefined
    throw error
  }))
}
