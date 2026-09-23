import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import {
  attributes,
  checked,
  escapeHtml
} from '@traq-flavored-markdown/core/html'
import type { Node } from '@traq-flavored-markdown/core/renderer'
import type { Plugin } from '@traq-flavored-markdown/core/renderer'

import type { Options } from './options.js'

function imageAltText(nodes: Node[] = [], source: string): string {
  let sourceBytes: Uint8Array | undefined
  const decoder = new TextDecoder()

  const collect = (children: Node[] = []): string =>
    children
      .map(node => {
        if (!isKnownNode(node))
          return decoder.decode(
            (sourceBytes ??= new TextEncoder().encode(source)).subarray(
              node.span.start,
              node.span.end
            )
          )

        switch (node.kind) {
          case names.Text:
            return node.data.value
          case names.HtmlInline:
            return node.data.literal
          case names.Softbreak:
          case names.Hardbreak:
            return '\n'
          case names.InlineCode:
            return node.data.literal
          default:
            return collect(node.children)
        }
      })
      .join('')

  return collect(nodes)
}

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
  result: Plugin,
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

  result.on(
    names.Text,
    checked(names.Text, isKnownNode, n => escapeHtml(n.data.value))
  )

  result.on(
    names.InlineCode,
    checked(
      names.InlineCode,
      isKnownNode,
      n => '<code>' + escapeHtml(n.data.literal) + '</code>'
    )
  )

  result.on(
    names.Softbreak,
    checked(names.Softbreak, isKnownNode, () =>
      breaks ? (xhtmlOut ? '<br />\n' : '<br>\n') : '\n'
    )
  )

  result.on(
    names.Hardbreak,
    checked(names.Hardbreak, isKnownNode, () =>
      xhtmlOut ? '<br />\n' : '<br>\n'
    )
  )

  result.on(
    names.Emphasis,
    checked(
      names.Emphasis,
      isKnownNode,
      (n, ctx) => '<em>' + ctx.render(n.children) + '</em>'
    )
  )

  result.on(
    names.Strong,
    checked(
      names.Strong,
      isKnownNode,
      (n, ctx) => '<strong>' + ctx.render(n.children) + '</strong>'
    )
  )

  result.on(
    names.Link,
    checked(names.Link, isKnownNode, (n, ctx) => {
      if (!validateLink(n.data.destination)) return ctx.fallback(n)

      const content = ctx.render(n.children)

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
  )

  result.on(
    names.Image,
    checked(names.Image, isKnownNode, (n, ctx) => {
      if (!validateImage(n.data.destination)) return ctx.fallback(n)

      return (
        '<img' +
        attributes([
          ['src', n.data.destination],
          ['alt', imageAltText(n.children, ctx.source)]
        ]) +
        titleAttribute(n.data.title) +
        (xhtmlOut ? ' />' : '>')
      )
    })
  )

  result.on(
    names.HtmlInline,
    checked(names.HtmlInline, isKnownNode, n =>
      rawHtml === 'escape' ? escapeHtml(n.data.literal) : n.data.literal
    )
  )
}
