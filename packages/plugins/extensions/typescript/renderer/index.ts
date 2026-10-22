import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { attributes } from '@traq-flavored-markdown/core/html'
import type { Node, RenderContext } from '@traq-flavored-markdown/core/renderer'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { names } from '@traq-flavored-markdown/extensions-plugin/nodes'

export interface Options {
  /** Return trusted HTML; absent adapters preserve escaped source. */
  math?(tex: string, displayMode: boolean): string
}

function table(node: Node, ctx: RenderContext) {
  return (
    '<table>\n' +
    ctx.renderChildren(rows => {
      for (const { node } of rows)
        if (!definitions.Row.is(node) && !definitions.HeaderRow.is(node))
          throw new TypeError('Invalid table row')
      const head = rows.filter(({ node }) => node.kind === names.HeaderRow)
      const body = rows.filter(({ node }) => node.kind === names.Row)
      return (
        '<thead>\n' +
        head.map(row => row.html).join('') +
        '</thead>\n' +
        (body.length
          ? '<tbody>\n' + body.map(row => row.html).join('') + '</tbody>\n'
          : '')
      )
    }) +
    '</table>\n'
  )
}

const declaration = Declaration.group('generic').plugin('presentation')

export function plugin({ math }: Options = {}) {
  let result = new RenderPlugin(declaration)

  result = result.on(
    definitions.Mark,
    (n, ctx) => '<mark>' + ctx.renderChildren() + '</mark>'
  )

  result = result.on(
    definitions.Strikethrough,
    (n, ctx) => '<s>' + ctx.renderChildren() + '</s>'
  )

  result = result.on(definitions.Table, table)

  result = result.on(
    definitions.Row,
    (_node, ctx) => '<tr>\n' + ctx.renderChildren() + '</tr>\n'
  )
  result = result.on(
    definitions.HeaderRow,
    (_node, ctx) => '<tr>\n' + ctx.renderChildren() + '</tr>\n'
  )
  result = result.on(definitions.Cell, (node, ctx) => {
    const row = ctx.ancestors.at(-1)
    const table = ctx.ancestors.at(-2)
    if (!row || (!definitions.Row.is(row) && !definitions.HeaderRow.is(row)))
      throw new TypeError('Expected table row parent')
    if (!table || !definitions.Table.is(table))
      throw new TypeError('Expected table ancestor')
    const tag = row.kind === names.HeaderRow ? 'th' : 'td'
    const alignment = table.data.alignments[ctx.index]
    const attrs = alignment
      ? attributes([['style', 'text-align:' + alignment]])
      : ''
    return '<' + tag + attrs + '>' + ctx.renderChildren() + '</' + tag + '>\n'
  })

  result = result.on(definitions.InlineMath, (node, ctx) =>
    math ? math(node.data.tex, false) : ctx.fallback(node)
  )

  result = result.on(definitions.BlockMath, (node, ctx) =>
    math ? math(node.data.tex, true) : ctx.fallback(node)
  )

  return result
}
