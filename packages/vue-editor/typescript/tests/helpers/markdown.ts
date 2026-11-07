import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

import { createRuntime, presets } from '@traq-flavored-markdown/sdk'
import {
  analyzeForEditing,
  describeSource
} from '@traq-flavored-markdown/sdk/editor'
import { createHtmlRenderer } from '@traq-flavored-markdown/sdk/renderer'
import { afterAll, vi } from 'vitest'

import { markdownFormats as formats } from '../../src/internal/markdown.js'
import type { MarkdownFormat } from '../../src/internal/markdown.js'
import { renderMarkdownWidget as widget } from '../../src/internal/markdownWidget.js'
import type { MarkdownServices } from '../../src/types.js'

// Real published parser bytes; no application loader, stores or network requests.
const runtime = await createRuntime(
  await readFile(
    createRequire(import.meta.url).resolve(
      '@traq-flavored-markdown/sdk/parser.wasm'
    )
  )
)
afterAll(() => runtime.dispose())
export const markdownParser = runtime.createParser(presets.traq.v1)
export const analyzeMarkdownSource = (source: string) =>
  describeSource(analyzeForEditing(markdownParser.parseWithSyntax(source)))
const renderer = createHtmlRenderer()
export const renderPreview = vi.fn<MarkdownServices['render']>(
  (document, node) => renderer.createSession(document).render({ roots: [node] })
)
export const markdownServices: MarkdownServices = {
  analyze: analyzeMarkdownSource,
  render: renderPreview
}
export const markdownFormats = (source: string) =>
  formats(analyzeMarkdownSource(source))
export const renderMarkdownWidget = (
  format: Extract<MarkdownFormat, { kind: 'rendered-inline' }>
) => widget(format, renderPreview)
export const getMarkdownRenderer = () => ({
  render: (source: string) => ({
    renderedText: renderer.render(markdownParser.parse(source))
  })
})
export const renderInline = (source: string) => ({
  renderedText: renderer.render(markdownParser.parseInline(source))
})
