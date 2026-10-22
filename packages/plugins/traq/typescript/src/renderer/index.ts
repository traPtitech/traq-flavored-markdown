import { validateLink as defaultPolicy } from '@traq-flavored-markdown/commonmark-plugin/policy'
import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { escapeHtml } from '@traq-flavored-markdown/core/html'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions } from '@traq-flavored-markdown/traq-plugin/nodes'

import { renderReference } from './reference.js'
import { stampRenderer } from './stamp.js'
import type { Options } from './types.js'

export type {
  Options,
  ReferenceResolver,
  ResolvedReference,
  StampResolver,
  ResolvedStamp,
  NamedStamp
} from './types.js'

const declaration = Declaration.group('trap').plugin('presentation')

export function plugin({
  resolveReference,
  resolveStamp,
  validateStampImage,
  xhtmlOut = false,
  validateLink = defaultPolicy
}: Options = {}) {
  let result = new RenderPlugin(declaration)

  result = result.on(definitions.Reference, node =>
    renderReference(node, resolveReference, validateLink)
  )

  result = result.on(
    definitions.Spoiler,
    (n, ctx) => '<span class="spoiler">' + ctx.renderChildren() + '</span>'
  )

  result = result.on(definitions.BlankLine, () =>
    xhtmlOut ? '<br />\n' : '<br>\n'
  )

  result = result.on(definitions.Embedding, node =>
    escapeHtml(node.data.literal)
  )

  const stamp = stampRenderer({ resolveStamp, validateStampImage })

  result = result.on(definitions.Stamp, node => stamp(node.data))

  return result
}
