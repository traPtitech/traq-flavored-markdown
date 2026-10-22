import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions as extensionDefinitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { definitions as trapDefinitions } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { ResolvedOptions } from '../profiles/traq.js'

function configureCommonCondensed(
  common: RenderPlugin,
  options: Pick<ResolvedOptions, 'validateLink'>
) {
  for (const definition of [definitions.Softbreak, definitions.Hardbreak])
    common = common.replace(definition, () => ' ')

  common = common.replace(definitions.Paragraph, (n, ctx) =>
    ctx.renderChildren()
  )

  common = common.replace(
    definitions.Heading,
    (n, ctx) => '#'.repeat(n.data.level) + ' ' + ctx.renderChildren()
  )

  common = common.replace(
    definitions.Blockquote,
    (_n, ctx) => '> ' + ctx.renderChildren(' ')
  )

  common = common.replace(definitions.List, (_n, ctx) =>
    ctx.renderChildren(' ')
  )

  common = common.replace(definitions.ListItem, (n, ctx) => {
    const list = ctx.ancestors.at(-1)
    if (!list || !definitions.List.is(list))
      throw new TypeError('Expected list parent')
    const kind = list.data.kind
    const marker =
      kind.type === 'ordered'
        ? String(kind.start + ctx.index) +
          (kind.delimiter === 'period' ? '.' : ')')
        : kind.marker
    return marker + ' ' + ctx.renderChildren(' ')
  })

  common = common.replace(
    definitions.ThematicBreak,
    n => ' ' + escapeHtml(n.data.marker) + ' '
  )

  common = common.replace(
    definitions.CodeBlock,
    n => '<code>' + escapeHtml(n.data.literal) + '</code>'
  )

  common = common.replace(definitions.HtmlBlock, n =>
    escapeHtml(n.data.literal)
  )

  common = common.replace(definitions.Image, (n, _ctx) => {
    const label = escapeHtml(n.data.label_source)

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
  extensions = extensions.replace(extensionDefinitions.Table, (_n, ctx) =>
    ctx.renderChildren(' ')
  )
  extensions = extensions.replace(
    extensionDefinitions.Row,
    (_n, ctx) => ctx.renderChildren(' ') + ' |'
  )
  extensions = extensions.replace(
    extensionDefinitions.HeaderRow,
    (_n, ctx) => ctx.renderChildren(' ') + ' |'
  )
  extensions = extensions.replace(
    extensionDefinitions.Cell,
    (_n, ctx) => '| ' + ctx.renderChildren()
  )

  return extensions
}

function configureTrapCondensed(trap: RenderPlugin) {
  trap = trap.replace(trapDefinitions.BlankLine, () => ' ')

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
