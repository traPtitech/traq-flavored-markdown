import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import {
  isKnownNode,
  names
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import type { Node } from '@traq-flavored-markdown/core/renderer'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'
import { decodeHTMLStrict } from 'entities'

import type { Options } from './options.js'

function tightList(node?: Node) {
  return (
    !!node && isKnownNode(node) && node.kind === names.List && node.data.tight
  )
}

type BlockOptions = Required<
  Pick<Options, 'rawHtml' | 'xhtmlOut' | 'isBlockSpacing'>
> &
  Pick<Options, 'highlight'>

function codeLanguage(info: string) {
  return info
    .replace(
      /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])|&(?:#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g,
      (match, escaped) => escaped ?? decodeHTMLStrict(match)
    )
    .trim()
    .split(/\s+/)[0]
}

export function registerBlockHandlers(
  result: RenderPlugin,
  { highlight, rawHtml, xhtmlOut, isBlockSpacing }: BlockOptions
) {
  result = result.on(definitions.Paragraph, (n, ctx) => {
    const content = ctx.renderChildren()

    return ctx.ancestors.at(-1)?.kind === names.ListItem &&
      tightList(ctx.ancestors.at(-2))
      ? content
      : '<p>' + content + '</p>\n'
  })

  result = result.on(
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

  result = result.on(
    definitions.Blockquote,
    (n, ctx) => '<blockquote>' + '\n' + ctx.renderChildren() + '</blockquote>\n'
  )

  result = result.on(definitions.List, (n, ctx) => {
    const kind = n.data.kind
    const tag = kind.type === 'ordered' ? 'ol' : 'ul'
    const attrs =
      kind.type === 'ordered' && kind.start !== 1
        ? attributes([['start', String(kind.start)]])
        : ''

    return '<' + tag + attrs + '>\n' + ctx.renderChildren() + '</' + tag + '>\n'
  })

  result = result.on(definitions.ListItem, (n, ctx) => {
    const tight = tightList(ctx.ancestors.at(-1))
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

  result = result.on(definitions.CodeBlock, n => {
    const language = n.data.fenced ? codeLanguage(n.data.info ?? '') : ''
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

  result = result.on(definitions.ThematicBreak, () =>
    xhtmlOut ? '<hr />\n' : '<hr>\n'
  )

  result = result.on(definitions.HtmlBlock, n =>
    rawHtml === 'escape'
      ? '<p>' + escapeHtml(n.data.literal) + '</p>\n'
      : n.data.literal
  )

  return result
}
