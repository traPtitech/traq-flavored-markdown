import { escapeText } from 'entities'
import { parseFragment } from 'parse5'

import type { DifferenceRow } from '../../protocol/comparison.ts'
import { resourceLabel } from './destinations.ts'
import { sourceForm } from './source.ts'

export function trailingStamp(html: string) {
  const match = /<i\b[^>]*>(:[^<>\r\n]+:)<\/i>(?:\s*<\/(?:span|p)>)*\s*$/i.exec(
    html
  )
  if (!match) return undefined

  const node = parseFragment(match[0]).childNodes[0]

  return node &&
    'tagName' in node &&
    node.tagName === 'i' &&
    node.attrs.some(
      attr => attr.name === 'class' && attr.value.split(/\s+/).includes('emoji')
    )
    ? match[1]
    : undefined
}

export function restoreResourceSuffix(
  html: string,
  before: string,
  source: string,
  profile: DifferenceRow['profile'] | undefined,
  origin?: string
) {
  // A preceding colon can turn the authored scheme into a stamp (:https:),
  // leaving a scheme-relative resource URL. Require the rendered stamp too;
  // ordinary scheme URL/card changes must remain visible.
  const stamp = trailingStamp(html)

  const tokens = [...source.trimEnd().matchAll(/\S+/g)].flatMap(token => {
    let relative: { 0: string; index: number } | null =
      /(?<![:/\w])\/\/[^\s<>]+$/.exec(token[0])

    const consumed = /(:[^:\s<>]+:)(\/\/[^\s<>]+)$/.exec(token[0])

    if (!relative && consumed && consumed[1] === stamp) {
      relative = {
        0: consumed[2],
        index: consumed.index + consumed[1].length
      }
    }

    return relative?.index && resourceLabel(relative[0], origin)
      ? [
          { 0: token[0].slice(0, relative.index), index: token.index },
          { 0: relative[0], index: token.index + relative.index }
        ]
      : [token]
  })

  const suffix: { value: string; start: number }[] = []

  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index]
    if (
      /^https?:\/\//i.test(token[0]) &&
      resourceLabel(token[0], origin) &&
      sourceForm(source, token[0]) === 'bare' &&
      !before.includes(escapeText(token[0])) &&
      !html.includes(escapeText(token[0]))
    ) {
      continue
    }

    if (
      !token[0].startsWith('//') ||
      !resourceLabel(token[0], origin) ||
      sourceForm(
        stamp ? source.replaceAll(stamp + token[0], ' ' + token[0]) : source,
        token[0]
      ) !== 'bare'
    ) {
      break
    }

    suffix.unshift({ value: token[0], start: token.index })
  }

  while (suffix.length && html.includes(escapeText(suffix[0].value))) {
    suffix.shift()
  }

  if (
    !suffix.length ||
    suffix.some(token => html.includes(escapeText(token.value)))
  ) {
    return html
  }

  const prefix = source.slice(0, suffix[0].start)
  if (/\n[ \t]*\n/.test(source.trimEnd().slice(suffix[0].start))) return html

  const inline = profile === 'inline'

  const trailingNewlines =
    source.match(/(?:\r?\n[ \t]*)+$/)?.[0].match(/\n/g)?.length ?? 0

  const trailingBlanks = inline
    ? ''
    : '<br>\n'.repeat(Math.max(0, trailingNewlines - 2))

  const separator = inline ? ' ' : '<br>\n'
  const content = suffix.map(token => escapeText(token.value)).join(separator)

  if (!prefix.trim() && !html.trim()) {
    return inline ? content : `<p>${content}</p>\n` + trailingBlanks
  }

  const softbreak = /\r?\n$/.test(prefix) && !/(?: {2,}|\\)\r?\n$/.test(prefix)
  const appended = (softbreak ? separator : '') + content
  if (inline) return html + appended

  if (/\n[ \t]*\n$/.test(prefix) && /<p><\/p>\n*$/.test(html)) {
    return html.replace(
      /<p><\/p>(\n*)$/,
      (_all, newline: string) => `<p>${content}</p>` + newline + trailingBlanks
    )
  }

  return html.replace(
    /<\/p>(\n*)$/,
    (_match, newline: string) => appended + '</p>' + newline + trailingBlanks
  )
}
