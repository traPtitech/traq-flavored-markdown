import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions as extensionDefinitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { definitions as trapDefinitions } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { ResolvedOptions } from '../profile/options.js'

function configureCommonCondensed(
  common: RenderPlugin,
  options: Pick<ResolvedOptions, 'validateLink'>
) {
  for (const definition of [definitions.Softbreak, definitions.Hardbreak])
    common = common.withReplacedHandler(definition, () => ' ')

  common = common.withReplacedHandler(definitions.Paragraph, (n, ctx) =>
    ctx.renderChildren()
  )

  common = common.withReplacedHandler(
    definitions.Heading,
    (n, ctx) => '#'.repeat(n.data.level) + ' ' + ctx.renderChildren()
  )

  common = common.withReplacedHandler(
    definitions.Blockquote,
    (_n, ctx) => '> ' + ctx.renderChildren(' ')
  )

  common = common.withReplacedHandler(definitions.List, (_n, ctx) =>
    ctx.renderChildren(' ')
  )

  common = common.withReplacedHandler(definitions.ListItem, (n, ctx) => {
    const list = ctx.parent(definitions.List)
    if (!list) throw new TypeError('Expected list parent')
    const kind = list.data.kind
    const marker =
      kind.type === 'ordered'
        ? String(kind.start + ctx.index) +
          (kind.delimiter === 'period' ? '.' : ')')
        : kind.marker
    return marker + ' ' + ctx.renderChildren(' ')
  })

  common = common.withReplacedHandler(
    definitions.ThematicBreak,
    n => ' ' + escapeHtml(n.data.marker) + ' '
  )

  common = common.withReplacedHandler(
    definitions.CodeBlock,
    n => '<code>' + escapeHtml(n.data.literal) + '</code>'
  )

  common = common.withReplacedHandler(definitions.HtmlBlock, n =>
    escapeHtml(n.data.literal)
  )

  common = common.withReplacedHandler(definitions.Image, (n, _ctx) => {
    const label = escapeHtml(n.data.labelSource)

    if (!options.validateLink(n.data.destination)) return label

    return (
      '<a' +
      attributes([
        ['href', n.data.destination],
        ...(n.data.title === null
          ? []
          : [['title', n.data.title] as [string, string]])
      ]) +
      ' data-is-image>' +
      label +
      '</a>'
    )
  })

  return common
}

function configureExtensionsCondensed(extensions: RenderPlugin) {
  extensions = extensions.withReplacedHandler(
    extensionDefinitions.Table,
    (_n, ctx) => ctx.renderChildren(' ')
  )
  for (const definition of [
    extensionDefinitions.Row,
    extensionDefinitions.HeaderRow
  ])
    extensions = extensions.withReplacedHandler(
      definition,
      (_n, ctx) => ctx.renderChildren(' ') + ' |'
    )
  extensions = extensions.withReplacedHandler(
    extensionDefinitions.Cell,
    (_n, ctx) => '| ' + ctx.renderChildren()
  )

  return extensions
}

function configureTrapCondensed(trap: RenderPlugin) {
  trap = trap.withReplacedHandler(trapDefinitions.BlankLine, () => ' ')

  return trap
}

/** A condensed traQ message is a flattened document, not inline-only parsing. */
export function configureCondensed(
  common: RenderPlugin,
  extensions: RenderPlugin,
  trap: RenderPlugin,
  options: Pick<ResolvedOptions, 'validateLink'>
) {
  return {
    common: configureCommonCondensed(common, options),
    extensions: configureExtensionsCondensed(extensions),
    traq: configureTrapCondensed(trap)
  }
}
