import { validateLink as defaultPolicy } from '@traq-flavored-markdown/commonmark-plugin/policy'
import { Plugin as Declaration } from '@traq-flavored-markdown/core/definitions'
import { checked, escapeHtml } from '@traq-flavored-markdown/core/html'
import { Plugin } from '@traq-flavored-markdown/core/renderer'
import { isKnownNode, names } from '@traq-flavored-markdown/traq-plugin/nodes'

import { renderReference } from './reference.js'
import { stampRenderer } from './stamp.js'
import type { Options } from './types.js'

export type { Options, Store } from './types.js'

const declaration = Declaration.group('trap').new('presentation')

export function plugin({
  store,
  baseUrl,
  validateLink = defaultPolicy
}: Options = {}) {
  let result = new Plugin(declaration)

  result = result.on(
    names.Reference,
    checked(names.Reference, isKnownNode, node =>
      renderReference(node, store, validateLink)
    )
  )

  result = result.on(
    names.Spoiler,
    checked(
      names.Spoiler,
      isKnownNode,
      (n, ctx) => '<span class="spoiler">' + ctx.render(n.children) + '</span>'
    )
  )

  result = result.on(
    names.BlankLine,
    checked(names.BlankLine, isKnownNode, () => '<br>\n')
  )

  result = result.on(
    names.Embedding,
    checked(names.Embedding, isKnownNode, node => escapeHtml(node.data.literal))
  )

  const stamp = stampRenderer({ store, baseUrl })

  result = result.on(
    names.Stamp,
    checked(names.Stamp, isKnownNode, node => stamp(node.data))
  )

  return result
}
