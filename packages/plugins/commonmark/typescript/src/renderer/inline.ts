import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'

import { imageLabelText } from '../semantics.js'
import type { Options } from './options.js'

function titleAttribute(title: string | null) {
  return title === null ? '' : attributes([['title', title]])
}

type InlineOptions = Required<
  Pick<
    Options,
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

  result = result.on(definitions.Text, n => escapeHtml(n.data.value))

  result = result.on(
    definitions.InlineCode,
    n => '<code>' + escapeHtml(n.data.literal) + '</code>'
  )

  result = result.on(definitions.Softbreak, () =>
    breaks ? (xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
  )

  result = result.on(definitions.Hardbreak, () =>
    xhtmlOut ? '<br />\n' : '<br>\n'
  )

  result = result.on(
    definitions.Emphasis,
    (n, ctx) => '<em>' + ctx.renderChildren() + '</em>'
  )

  result = result.on(
    definitions.Strong,
    (n, ctx) => '<strong>' + ctx.renderChildren() + '</strong>'
  )

  result = result.on(definitions.Link, (n, ctx) => {
    if (!validateLink(n.data.destination)) return ctx.fallback(n)

    const content = ctx.renderChildren()

    return (
      '<a' +
      attributes([['href', n.data.destination]]) +
      linkAttrs +
      titleAttribute(n.data.title) +
      '>' +
      content +
      '</a>'
    )
  })

  result = result.on(definitions.Image, (n, ctx) => {
    if (!validateImage(n.data.destination)) return ctx.fallback(n)

    return (
      '<img' +
      attributes([
        ['src', n.data.destination],
        ['alt', imageLabelText(n.children, ctx.sourceSlice)]
      ]) +
      titleAttribute(n.data.title) +
      (xhtmlOut ? ' />' : '>')
    )
  })

  result = result.on(definitions.HtmlInline, n =>
    rawHtml === 'escape' ? escapeHtml(n.data.literal) : n.data.literal
  )

  return result
}
