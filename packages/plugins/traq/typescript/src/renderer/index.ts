import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { validateLink as defaultPolicy } from '@traq-flavored-markdown/core/html'
import { escapeHtml } from '@traq-flavored-markdown/core/html'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions } from '@traq-flavored-markdown/traq-plugin/nodes'

import { renderReference } from './reference.js'
import { stampRenderer } from './stamp.js'
import type { HtmlRendererOptions } from './types.js'

export type {
  HtmlRendererOptions,
  ReferenceResolver,
  ResolvedReference,
  StampResolver,
  ResolvedStamp,
  NamedStamp
} from './types.js'

const declaration = Declaration.group('traq').plugin('presentation')

export function plugin({
  resolveReference,
  resolveStamp,
  validateStampImage,
  xhtmlOut = false,
  validateLink = defaultPolicy
}: HtmlRendererOptions = {}) {
  let result = new RenderPlugin(declaration)

  result = result.withHandler(definitions.Reference, node =>
    renderReference(node, resolveReference, validateLink)
  )

  result = result.withHandler(
    definitions.Spoiler,
    (n, ctx) => '<span class="spoiler">' + ctx.renderChildren() + '</span>'
  )

  result = result.withHandler(definitions.BlankLine, () =>
    xhtmlOut ? '<br />\n' : '<br>\n'
  )

  result = result.withHandler(definitions.Embedding, node =>
    escapeHtml(node.data.literal)
  )

  const stamp = stampRenderer({ resolveStamp, validateStampImage })

  result = result.withHandler(definitions.Stamp, node => stamp(node.data))

  return result
}
