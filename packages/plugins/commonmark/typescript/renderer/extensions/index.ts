import type { RowData } from '@traq-flavored-markdown/commonmark-plugin/generic/nodes'
import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/generic/nodes'
import { Plugin as Declaration } from '@traq-flavored-markdown/core/definitions'
import { attributes, checked } from '@traq-flavored-markdown/core/html'
import type { Node, RenderContext } from '@traq-flavored-markdown/core/renderer'
import { Plugin } from '@traq-flavored-markdown/core/renderer'

import { math as defaultMath } from './math.js'

export interface Options {
  /** Return trusted HTML. KaTeX is used by default. */
  math?(tex: string, displayMode: boolean): string
}

function table(node: Node, ctx: RenderContext) {
  const rows = (node.children ?? []).map(row => {
    if (!isKnownNode(row) || row.kind !== names.Row)
      throw new TypeError('Invalid table row')

    return row
  })

  const head = rows.filter(r => r.data.header),
    body = rows.filter(r => !r.data.header)
  return (
    '<table>\n<thead>\n' +
    head.map(node => row(node, ctx)).join('') +
    '</thead>\n' +
    (body.length
      ? '<tbody>\n' + body.map(node => row(node, ctx)).join('') + '</tbody>\n'
      : '') +
    '</table>\n'
  )
}

function row(node: Node & { data: RowData }, ctx: RenderContext) {
  const tag = node.data.header ? 'th' : 'td'

  const cells = (node.children ?? [])
    .map(cell => {
      if (!isKnownNode(cell) || cell.kind !== names.Cell)
        throw new TypeError('Invalid table cell')

      const attrs = cell.data.alignment
        ? attributes([['style', 'text-align:' + cell.data.alignment]])
        : ''
      return (
        '<' + tag + attrs + '>' + ctx.render(cell.children) + '</' + tag + '>\n'
      )
    })
    .join('')

  return '<tr>\n' + cells + '</tr>\n'
}

const declaration = Declaration.group('generic').new('presentation')

export function plugin({ math = defaultMath }: Options = {}) {
  let result = new Plugin(declaration)

  result = result.on(
    names.Mark,
    checked(
      names.Mark,
      isKnownNode,
      (n, ctx) => '<mark>' + ctx.render(n.children) + '</mark>'
    )
  )

  result = result.on(
    names.Strikethrough,
    checked(
      names.Strikethrough,
      isKnownNode,
      (n, ctx) => '<s>' + ctx.render(n.children) + '</s>'
    )
  )

  result = result.on(names.Table, checked(names.Table, isKnownNode, table))

  result = result.on(
    names.InlineMath,
    checked(names.InlineMath, isKnownNode, node => math(node.data.tex, false))
  )

  result = result.on(
    names.BlockMath,
    checked(names.BlockMath, isKnownNode, node => math(node.data.tex, true))
  )

  return result
}
