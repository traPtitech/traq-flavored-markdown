import {
  names as genericNames,
  isKnownNode as genericNode
} from '@traq-markdown-engine/commonmark-plugin/generic/nodes'
import {
  isKnownNode,
  names
} from '@traq-markdown-engine/commonmark-plugin/nodes'
import { validateLink as defaultPolicy } from '@traq-markdown-engine/commonmark-plugin/policy'
import {
  attributes,
  checked,
  escapeHtml
} from '@traq-markdown-engine/core/html'
import type { Node, RenderContext } from '@traq-markdown-engine/core/renderer'
import type { Plugin } from '@traq-markdown-engine/core/renderer'
import {
  names as trapNames,
  isKnownNode as trapNode
} from '@traq-markdown-engine/traq-plugin/nodes'

import type { Options } from './index.js'

const blocks = (nodes: Node[] | undefined, ctx: RenderContext) =>
  (nodes ?? []).map(node => ctx.render([node])).join(' ')

function configureCommonCondensed(common: Plugin, options: Options) {
  for (const kind of [names.Softbreak, names.Hardbreak])
    common.replace(
      kind,
      checked(kind, isKnownNode, () => ' ')
    )

  common.replace(
    names.Paragraph,
    checked(names.Paragraph, isKnownNode, (n, ctx) => ctx.render(n.children))
  )

  common.replace(
    names.Heading,
    checked(
      names.Heading,
      isKnownNode,
      (n, ctx) => '#'.repeat(n.data.level) + ' ' + ctx.render(n.children)
    )
  )

  common.replace(
    names.Blockquote,
    checked(
      names.Blockquote,
      isKnownNode,
      (n, ctx) => '> ' + blocks(n.children, ctx)
    )
  )

  common.replace(
    names.List,
    checked(names.List, isKnownNode, (n, ctx) => {
      let index = 0
      const children = n.data.ordered
        ? (n.children ?? []).map(child => {
            if (!isKnownNode(child) || child.kind !== names.ListItem) {
              return child
            }

            return {
              ...child,
              data: {
                marker: `${n.data.start + index++}${child.data.marker.slice(-1)}`
              }
            }
          })
        : n.children

      return blocks(children, ctx)
    })
  )

  common.replace(
    names.ListItem,
    checked(
      names.ListItem,
      isKnownNode,
      (n, ctx) => n.data.marker + ' ' + blocks(n.children, ctx)
    )
  )

  common.replace(
    names.ThematicBreak,
    checked(
      names.ThematicBreak,
      isKnownNode,
      n => ' ' + escapeHtml(n.data.marker) + ' '
    )
  )

  common.replace(
    names.CodeBlock,
    checked(
      names.CodeBlock,
      isKnownNode,
      n => '<code>' + escapeHtml(n.data.literal) + '</code>'
    )
  )

  common.replace(
    names.HtmlBlock,
    checked(names.HtmlBlock, isKnownNode, n => escapeHtml(n.data.literal))
  )

  common.replace(
    names.Image,
    checked(names.Image, isKnownNode, (n, _ctx) => {
      const label = escapeHtml(n.data.label_source)

      if (!(options.validateLink ?? defaultPolicy)(n.data.destination))
        return label

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
  )
}

function configureGenericCondensed(generic: Plugin) {
  generic.replace(
    genericNames.Table,
    checked(genericNames.Table, genericNode, (n, ctx) =>
      (n.children ?? [])
        .map(row => {
          if (!genericNode(row) || row.kind !== genericNames.Row)
            throw new TypeError('Invalid table row')

          return (
            (row.children ?? [])
              .map(cell => {
                if (!genericNode(cell) || cell.kind !== genericNames.Cell)
                  throw new TypeError('Invalid table cell')

                return '| ' + ctx.render(cell.children)
              })
              .join(' ') + ' |'
          )
        })
        .join(' ')
    )
  )
}

function configureTrapCondensed(trap: Plugin) {
  trap.replace(
    trapNames.BlankLine,
    checked(trapNames.BlankLine, trapNode, () => ' ')
  )
}

/** A condensed traQ message is a flattened document, not inline-only parsing. */
export function configureCondensed(
  common: Plugin,
  generic: Plugin,
  trap: Plugin,
  options: Options
) {
  configureCommonCondensed(common, options)
  configureGenericCondensed(generic)
  configureTrapCondensed(trap)
}
