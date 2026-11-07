import { createRuntime, presets } from '@traq-flavored-markdown/sdk'
import {
  analyzeForEditing,
  describeSource
} from '@traq-flavored-markdown/sdk/editor'
import wasmUrl from '@traq-flavored-markdown/sdk/parser.wasm?url'
import { createHtmlRenderer } from '@traq-flavored-markdown/sdk/renderer'
import type { MarkdownServices } from '@traq-flavored-markdown/vue-editor'
import '@traq-flavored-markdown/vue-editor/style.css'
import { createApp } from 'vue'

import App from './App.vue'

async function main() {
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error(`Parser load failed: ${response.status}`)
  const runtime = await createRuntime(
    new Uint8Array(await response.arrayBuffer())
  )
  const parser = runtime.createParser(presets.traq.v1)
  const renderer = createHtmlRenderer()
  const markdown: MarkdownServices = {
    analyze: text =>
      describeSource(analyzeForEditing(parser.parseWithSyntax(text))),
    render: (document, node) =>
      renderer.createSession(document).render({ roots: [node] })
  }
  const app = createApp(App, { markdown })
  app.mount('#app')
  window.addEventListener(
    'pagehide',
    () => {
      app.unmount()
      runtime.dispose()
    },
    { once: true }
  )
}
main().catch(error => {
  const root = document.getElementById('app')
  if (root) root.textContent = String(error)
})
