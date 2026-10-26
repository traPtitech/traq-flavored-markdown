import { PluginDeclaration as Declaration } from '@traq-flavored-markdown/core/definitions'
import { attributes } from '@traq-flavored-markdown/core/html'
import type {
  ReadonlyNode,
  RenderContext
} from '@traq-flavored-markdown/core/renderer'
import { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { definitions } from '@traq-flavored-markdown/extensions-plugin/nodes'
import { names } from '@traq-flavored-markdown/extensions-plugin/nodes'

export interface HtmlRendererOptions {
  /** Return trusted HTML; absent adapters preserve escaped source. */
  math?(tex: string, displayMode: boolean): string
}

function table(node: ReadonlyNode, ctx: RenderContext) {
  return (
    '<table>\n' +
    ctx.renderChildren(rows => {
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

const declaration = Declaration.group('extensions').plugin('presentation')

export function plugin({ math }: HtmlRendererOptions = {}) {
  let result = new RenderPlugin(declaration)

  result = result.withHandler(
    definitions.Mark,
    (n, ctx) => '<mark>' + ctx.renderChildren() + '</mark>'
  )

  result = result.withHandler(
    definitions.Strikethrough,
    (n, ctx) => '<s>' + ctx.renderChildren() + '</s>'
  )

  result = result.withHandler(definitions.Table, table)

  for (const definition of [definitions.Row, definitions.HeaderRow])
    result = result.withHandler(
      definition,
      (_node, ctx) => '<tr>\n' + ctx.renderChildren() + '</tr>\n'
    )
  result = result.withHandler(definitions.Cell, (node, ctx) => {
    const row = ctx.parent(definitions.Row) ?? ctx.parent(definitions.HeaderRow)
    const table = ctx.parent(definitions.Table, 2)
    if (!row) throw new TypeError('Expected table row parent')
    if (!table) throw new TypeError('Expected table ancestor')
    const tag = row.kind === names.HeaderRow ? 'th' : 'td'
    const alignment = table.data.alignments[ctx.index]
    const attrs = alignment
      ? attributes([['style', 'text-align:' + alignment]])
      : ''
    return '<' + tag + attrs + '>' + ctx.renderChildren() + '</' + tag + '>\n'
  })

  result = result.withHandler(definitions.InlineMath, (node, ctx) =>
    math ? math(node.data.tex, false) : ctx.fallback(node)
  )

  result = result.withHandler(definitions.BlockMath, (node, ctx) =>
    math ? math(node.data.tex, true) : ctx.fallback(node)
  )

  return result
}
