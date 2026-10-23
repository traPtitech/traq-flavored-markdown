import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'

import { imageLabelText } from '../semantics.js'
import type { HtmlRendererOptions } from './options.js'

function titleAttribute(title: string | null) {
  return title === null ? '' : attributes([['title', title]])
}

type InlineOptions = Required<
  Pick<
    HtmlRendererOptions,
    | 'validateLink'
    | 'validateImage'
    | 'breaks'
    | 'rawHtml'
    | 'xhtmlOut'
    | 'linkAttributes'
  >
>

export function registerInlineHandlers(
  result: RenderPlugin,
  {
    validateLink,
    validateImage,
    breaks,
    rawHtml,
    xhtmlOut,
    linkAttributes
  }: InlineOptions
) {
  const linkAttrs = attributes(Object.entries(linkAttributes))
  const link = (destination: string, title: string | null, content: string) =>
    '<a' +
    attributes([['href', destination]]) +
    linkAttrs +
    titleAttribute(title) +
    '>' +
    content +
    '</a>'

  result = result.withHandler(definitions.Text, n => escapeHtml(n.data.value))

  result = result.withHandler(
    definitions.InlineCode,
    n => '<code>' + escapeHtml(n.data.literal) + '</code>'
  )

  result = result.withHandler(definitions.Softbreak, () =>
    breaks ? (xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
  )

  result = result.withHandler(definitions.Hardbreak, () =>
    xhtmlOut ? '<br />\n' : '<br>\n'
  )

  result = result.withHandler(
    definitions.Emphasis,
    (n, ctx) => '<em>' + ctx.renderChildren() + '</em>'
  )

  result = result.withHandler(
    definitions.Strong,
    (n, ctx) => '<strong>' + ctx.renderChildren() + '</strong>'
  )

  result = result.withHandler(definitions.Link, (n, ctx) => {
    if (!validateLink(n.data.destination)) return ctx.fallback(n)

    return link(n.data.destination, n.data.title, ctx.renderChildren())
  })

  result = result.withHandler(definitions.Image, (n, ctx) => {
    const label = imageLabelText(n.children, ctx.sourceSlice, ctx.matches)
    if (!validateImage(n.data.destination)) {
      if (!validateLink(n.data.destination)) return ctx.fallback(n)
      const content = escapeHtml(label)
      return (
        '!' +
        (ctx.ancestors.some(node => node.kind === definitions.Link.kind)
          ? content
          : link(n.data.destination, n.data.title, content))
      )
    }

    return (
      '<img' +
      attributes([
        ['src', n.data.destination],
        ['alt', label]
      ]) +
      titleAttribute(n.data.title) +
      (xhtmlOut ? ' />' : '>')
    )
  })

  result = result.withHandler(definitions.HtmlInline, n =>
    rawHtml === 'escape' ? escapeHtml(n.data.literal) : n.data.literal
  )

  return result
}
