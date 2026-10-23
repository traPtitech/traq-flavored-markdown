import { names, schema } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import {
  validateImage as defaultImagePolicy,
  validateLink as defaultPolicy
} from '@traq-flavored-markdown/core/html'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import { createRenderer } from '@traq-flavored-markdown/core/renderer'

import { registerBlockHandlers } from './block.js'
import { registerInlineHandlers } from './inline.js'
import type { HtmlRendererOptions } from './options.js'

export type { HighlightResult, HtmlRendererOptions } from './options.js'

const declaration = Declaration.group('commonmark').plugin('core')
const allowAll = () => true

export { names as nodes }

/** CommonMark specification handlers; raw HTML and links pass through by default. */
export function plugin({
  validateLink = allowAll,
  validateImage = allowAll,
  breaks = false,
  rawHtml = 'passthrough',
  xhtmlOut = true,
  highlight,
  isBlockSpacing = () => false,
  linkAttributes = {}
}: HtmlRendererOptions = {}) {
  let result = new RenderPlugin(declaration)

  result = registerInlineHandlers(result, {
    validateLink,
    validateImage,
    breaks,
    rawHtml,
    xhtmlOut,
    linkAttributes
  })

  result = registerBlockHandlers(result, {
    highlight,
    rawHtml,
    xhtmlOut,
    isBlockSpacing
  })

  return result
}

/** Compose a standalone HTML preset with safe display defaults. */
export function createHtmlPreset({
  validateLink = defaultPolicy,
  validateImage = defaultImagePolicy,
  rawHtml = 'escape',
  xhtmlOut = false,
  ...options
}: HtmlRendererOptions = {}) {
  return new PresetBuilder()
    .add(
      plugin({
        ...options,
        validateLink,
        validateImage,
        rawHtml,
        xhtmlOut
      })
    )
    .build()
}

/** Render CommonMark with safe display defaults. */
export function createHtmlRenderer(options?: HtmlRendererOptions) {
  return createRenderer(createHtmlPreset(options), {
    schema: schema.withUnknownNodes()
  })
}

/** Compose CommonMark specification handlers without display restrictions. */
export function createSpecHtmlPreset(options?: HtmlRendererOptions) {
  return new PresetBuilder().add(plugin(options)).build()
}

/** Render CommonMark specification HTML. Unsafe for untrusted input. */
export function createSpecHtmlRenderer(options?: HtmlRendererOptions) {
  return createRenderer(createSpecHtmlPreset(options), {
    schema: schema.withUnknownNodes()
  })
}
