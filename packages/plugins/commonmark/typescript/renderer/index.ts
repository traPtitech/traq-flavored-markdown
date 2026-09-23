import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { Plugin as Declaration } from '@traq-flavored-markdown/core/definitions'
import { Plugin } from '@traq-flavored-markdown/core/renderer'
import { PresetBuilder } from '@traq-flavored-markdown/core/renderer'

import { registerBlockHandlers } from './block.js'
import { registerInlineHandlers } from './inline.js'
import type { Options } from './options.js'
import {
  validateImage as defaultImagePolicy,
  validateLink as defaultPolicy
} from './policy.js'

export type { Options } from './options.js'

const declaration = Declaration.group('commonmark').new('core')
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
  linkAttributes = {}
}: Options = {}) {
  const result = new Plugin(declaration)

  registerInlineHandlers(result, {
    validateLink,
    validateImage,
    breaks,
    rawHtml,
    xhtmlOut,
    linkAttributes
  })

  registerBlockHandlers(result, { highlight, rawHtml, xhtmlOut })

  return result
}

/** Build a standalone HTML preset with safe display defaults. */
export function html(options?: Options) {
  return new PresetBuilder()
    .add(
      plugin({
        validateLink: defaultPolicy,
        validateImage: defaultImagePolicy,
        rawHtml: 'escape',
        xhtmlOut: false,
        ...options
      })
    )
    .build()
}

/** Render CommonMark structure without display restrictions. Unsafe for untrusted HTML. */
export function specHtml(options?: Options) {
  return new PresetBuilder().add(plugin(options)).build()
}
