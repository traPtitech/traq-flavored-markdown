import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'
import { renderer } from '@traq-flavored-markdown/core/renderer'

import { registerBlockHandlers } from './block.js'
import { registerInlineHandlers } from './inline.js'
import type { Options } from './options.js'
import {
  validateImage as defaultImagePolicy,
  validateLink as defaultPolicy
} from './policy.js'

export type { HighlightResult, Options } from './options.js'

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
}: Options = {}) {
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
export function htmlPreset({
  validateLink = defaultPolicy,
  validateImage = defaultImagePolicy,
  rawHtml = 'escape',
  xhtmlOut = false,
  ...options
}: Options = {}) {
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
export function html(options?: Options) {
  return renderer(htmlPreset(options))
}

/** Compose CommonMark specification handlers without display restrictions. */
export function specHtmlPreset(options?: Options) {
  return new PresetBuilder().add(plugin(options)).build()
}

/** Render CommonMark specification HTML. Unsafe for untrusted input. */
export function specHtml(options?: Options) {
  return renderer(specHtmlPreset(options))
}
