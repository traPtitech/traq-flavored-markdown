import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions as extensionDefinitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { definitions as traqDefinitions } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { ResolvedOptions } from '../profile/options.js'

function configureCommonCondensed(
  common: RenderPlugin,
  options: Pick<ResolvedOptions, 'links'>
) {
  for (const definition of [definitions.Softbreak, definitions.Hardbreak]) {
    common = common.withReplacedHandler(definition, () => ' ')
  }

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

  common = common.withReplacedHandler(definitions.Image, (n, ctx) => {
    if (
      ctx.insideLink ||
      !n.data.destination ||
      !options.links.condensedImage.validateLink(n.data.destination)
    ) {
      return ctx.renderChildren()
    }

    const label = ctx.renderChildren('', { insideLink: true })

    return (
      '<a' +
      attributes([
        ['href', n.data.destination],
        ...Object.entries(options.links.condensedImage.linkAttributes),
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
  ]) {
    extensions = extensions.withReplacedHandler(
      definition,
      (_n, ctx) => ctx.renderChildren(' ') + ' |'
    )
  }

  extensions = extensions.withReplacedHandler(
    extensionDefinitions.Cell,
    (_n, ctx) => '| ' + ctx.renderChildren()
  )

  return extensions
}

function configureTraqCondensed(traq: RenderPlugin) {
  traq = traq.withReplacedHandler(traqDefinitions.BlankLine, () => ' ')

  return traq
}

/** A condensed traQ message is a flattened document, not inline-only parsing. */
export function configureCondensed(
  common: RenderPlugin,
  extensions: RenderPlugin,
  traq: RenderPlugin,
  options: Pick<ResolvedOptions, 'links'>
) {
  return {
    common: configureCommonCondensed(common, options),
    extensions: configureExtensionsCondensed(extensions),
    traq: configureTraqCondensed(traq)
  }
}
