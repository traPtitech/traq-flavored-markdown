import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { names } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'

import { codeLanguage } from '../semantics.js'
import type { HtmlRendererOptions } from './options.js'

type BlockOptions = Required<
  Pick<HtmlRendererOptions, 'rawHtml' | 'xhtmlOut' | 'isBlockSpacing'>
> &
  Pick<HtmlRendererOptions, 'highlight'>

export function registerBlockHandlers(
  result: RenderPlugin,
  { highlight, rawHtml, xhtmlOut, isBlockSpacing }: BlockOptions
) {
  result = result.withHandler(definitions.Paragraph, (n, ctx) => {
    const content = ctx.renderChildren()

    return ctx.ancestors.at(-1)?.kind === names.ListItem &&
      ctx.parent(definitions.List, 2)?.data.tight
      ? content
      : '<p>' + content + '</p>\n'
  })

  result = result.withHandler(
    definitions.Heading,
    (n, ctx) =>
      '<h' +
      n.data.level +
      '>' +
      ctx.renderChildren() +
      '</h' +
      n.data.level +
      '>\n'
  )

  result = result.withHandler(
    definitions.Blockquote,
    (n, ctx) => '<blockquote>' + '\n' + ctx.renderChildren() + '</blockquote>\n'
  )

  result = result.withHandler(definitions.List, (n, ctx) => {
    const kind = n.data.kind
    const tag = kind.type === 'ordered' ? 'ol' : 'ul'
    const attrs =
      kind.type === 'ordered' && kind.start !== 1
        ? attributes([['start', String(kind.start)]])
        : ''

    return '<' + tag + attrs + '>\n' + ctx.renderChildren() + '</' + tag + '>\n'
  })

  result = result.withHandler(definitions.ListItem, (n, ctx) => {
    const tight = ctx.parent(definitions.List)?.data.tight
    const content = ctx.renderChildren(children => {
      const lead =
        children.length && !(tight && children[0].node.kind === names.Paragraph)
          ? '\n'
          : ''
      return (
        lead +
        children
          .map(({ node, html }, index) => {
            // A spacing node following a tight paragraph needs no extra whitespace.
            const separator =
              tight &&
              index > 0 &&
              children[index - 1].node.kind === names.Paragraph &&
              node.kind !== names.CodeBlock &&
              !isBlockSpacing(node)
                ? '\n'
                : ''
            return separator + html
          })
          .join('')
      )
    })
    return '<li>' + content + '</li>\n'
  })

  result = result.withHandler(definitions.CodeBlock, n => {
    const language = n.data.fenced ? codeLanguage(n.data.info) : ''
    const highlighted = n.data.fenced
      ? highlight?.(n.data.literal, language)
      : undefined
    if (
      highlighted !== undefined &&
      (!highlighted ||
        typeof highlighted.html !== 'string' ||
        (highlighted.kind !== 'content' && highlighted.kind !== 'block'))
    )
      throw new TypeError('Invalid highlight result')

    if (highlighted?.kind === 'block') return highlighted.html + '\n'

    const attrs = language
      ? attributes([['class', 'language-' + language]])
      : ''
    const content = highlighted?.html ?? escapeHtml(n.data.literal)
    return '<pre><code' + attrs + '>' + content + '</code></pre>\n'
  })

  result = result.withHandler(definitions.ThematicBreak, () =>
    xhtmlOut ? '<hr />\n' : '<hr>\n'
  )

  result = result.withHandler(definitions.HtmlBlock, n =>
    rawHtml === 'escape'
      ? '<p>' + escapeHtml(n.data.literal) + '</p>\n'
      : n.data.literal
  )

  return result
}
