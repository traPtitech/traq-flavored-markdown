import { escapeText } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

import type { DifferenceRow } from '../protocol/comparison.ts'

type LinkRow = Pick<DifferenceRow, 'before' | 'after'> &
  Partial<Pick<DifferenceRow, 'source' | 'profile'>>
type Edit = { start: number; end: number; value: string }
const literalContexts = new Set(
  'code pre script style textarea title listing xmp iframe noembed noframes plaintext template'.split(
    ' '
  )
)
const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function completedDomain(value: string) {
  if (/^[a-z][a-z0-9+.-]{1,31}:/i.test(value) || /[\s<>@]/.test(value))
    return false
  try {
    const url = new URL(
      value.startsWith('//') ? 'https:' + value : 'https://' + value
    )
    return (
      url.hostname.includes('.') &&
      url.hostname
        .split('.')
        .every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))
    )
  } catch {
    return false
  }
}

function sourceForm(
  source: string,
  label: string
): 'bare' | 'angle' | undefined {
  if (!label) return undefined
  let form: 'bare' | 'angle' | undefined
  let offset = 0
  while ((offset = source.indexOf(label, offset)) !== -1) {
    const prefix = source.slice(0, offset)
    const line = prefix.slice(prefix.lastIndexOf('\n') + 1)
    // Ambiguous repeated URLs are retained if any occurrence is explicit.
    if (
      prefix.lastIndexOf('[') > prefix.lastIndexOf(']') ||
      prefix.lastIndexOf('](') > prefix.lastIndexOf(')') ||
      prefix.lastIndexOf('!{') > prefix.lastIndexOf('}') ||
      /^ {0,3}\[[^\]]+\]:/.test(line)
    )
      return undefined
    const angled = prefix.endsWith('<') && source[offset + label.length] === '>'
    if (angled) {
      if (!completedDomain(label)) return undefined
      form ??= 'angle'
    } else form = 'bare'
    offset += label.length
  }
  return form
}

function automaticDestination(href: string, label: string, forceHttps = false) {
  const targets = forceHttps
    ? [label.startsWith('//') ? 'https:' + label : 'https://' + label]
    : /^[a-z][a-z0-9+.-]*:/i.test(label)
      ? [label]
      : label.startsWith('//') && completedDomain(label)
        ? ['https:' + label]
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(label)
          ? ['mailto:' + label]
          : completedDomain(label)
            ? ['http://' + label, 'https://' + label]
            : []
  try {
    const actual = new URL(href.startsWith('//') ? 'https:' + href : href)
    return (
      ['http:', 'https:', 'ftp:', 'mailto:'].includes(actual.protocol) &&
      targets.some(target => {
        try {
          return new URL(target).href === actual.href
        } catch {
          return false
        }
      })
    )
  } catch {
    return false
  }
}

function resourceLabel(value: string, origin?: string) {
  if (!origin) return undefined
  const path = value.startsWith(origin.replace(/\/+$/, '') + '/')
    ? value.slice(origin.replace(/\/+$/, '').length)
    : ''
  const match =
    /^\/(files|messages)\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:[?#][^\s<>]*)?$/i.exec(
      path
    )
  return match
    ? match[1].toLowerCase() === 'files'
      ? '添付ファイル'
      : '引用メッセージ'
    : undefined
}

function normalizeHtml(
  value: string,
  source: string,
  domains: string[],
  side: 'before' | 'after',
  origin?: string
) {
  let invalid = false
  const fragment = parseFragment(value, {
    sourceCodeLocationInfo: true,
    onParseError: () => {
      invalid = true
    }
  })
  if (invalid) return undefined
  const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
  const edits: Edit[] = []
  const forced = new Map<string, number>()
  while (pending.length) {
    const node = pending.pop()!
    if ('tagName' in node) {
      if (literalContexts.has(node.tagName)) continue
      if (node.tagName === 'a') {
        const location = node.sourceCodeLocation
        if (!location?.startTag || !location.endTag) return undefined
        const href = node.attrs.find(attr => attr.name === 'href')?.value
        const ordinary = node.attrs.every(
          attr =>
            attr.name === 'href' ||
            (attr.name === 'target' && attr.value === '_blank') ||
            (attr.name === 'rel' &&
              attr.value
                .split(/\s+/)
                .every(word =>
                  ['nofollow', 'noopener', 'noreferrer'].includes(word)
                ))
        )
        if (
          href &&
          ordinary &&
          node.childNodes.every(child => 'value' in child)
        ) {
          const label = node.childNodes
            .map(child => ('value' in child ? child.value : ''))
            .join('')
          const form = sourceForm(source, label)
          const resource = resourceLabel(href, origin)
          let replacement: string | undefined
          if (
            form &&
            (side === 'before' || form === 'angle') &&
            (form !== 'angle' || domains.includes(label)) &&
            automaticDestination(
              href,
              label,
              side === 'after' && form === 'angle'
            )
          ) {
            replacement = value.slice(
              location.startTag.endOffset,
              location.endTag.startOffset
            )
            if (form === 'angle')
              forced.set(label, (forced.get(label) ?? 0) + 1)
          } else if (
            side === 'before' &&
            resource &&
            [`[${resource}]`, `[[${resource}]]`].includes(label) &&
            sourceForm(source, href) === 'bare'
          ) {
            replacement = escapeText(href)
          }
          if (replacement !== undefined) {
            let start = location.startTag.startOffset
            let end = location.endTag.endOffset
            if (side === 'before' && form === 'angle') {
              const opening = /(?:&lt;|&#0*60;|&#x0*3c;)$/i.exec(
                value.slice(0, start)
              )
              const closing = /^(?:&gt;|&#0*62;|&#x0*3e;)/i.exec(
                value.slice(end)
              )
              if (opening && closing) {
                start -= opening[0].length
                end += closing[0].length
              }
            }
            edits.push({ start, end, value: replacement })
            continue
          }
        }
      }
    } else if ('value' in node && node.sourceCodeLocation) {
      const location = node.sourceCodeLocation
      let text = value.slice(location.startOffset, location.endOffset)
      for (const domain of domains) {
        const pattern = new RegExp(
          `(?:&lt;|&#0*60;|&#x0*3c;)${escapePattern(escapeText(domain))}(?:&gt;|&#0*62;|&#x0*3e;)`,
          'gi'
        )
        text = text.replace(pattern, () => escapeText(domain))
      }
      if (text !== value.slice(location.startOffset, location.endOffset))
        edits.push({
          start: location.startOffset,
          end: location.endOffset,
          value: text
        })
    }
    if ('childNodes' in node) pending.push(...node.childNodes)
  }
  edits.sort((a, b) => a.start - b.start)
  let end = 0
  const parts: string[] = []
  for (const edit of edits) {
    if (edit.start < end) return undefined
    parts.push(value.slice(end, edit.start), edit.value)
    end = edit.end
  }
  parts.push(value.slice(end))
  return { value: parts.join(''), forced }
}

function restoreResourceSuffix(
  before: string,
  source: string,
  profile: LinkRow['profile'],
  origin?: string
) {
  const tokens = [...source.trimEnd().matchAll(/\S+/g)]
  const suffix: { value: string; start: number }[] = []
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index]
    if (
      !resourceLabel(token[0], origin) ||
      sourceForm(source, token[0]) !== 'bare'
    )
      break
    suffix.unshift({ value: token[0], start: token.index })
  }
  while (suffix.length && before.includes(escapeText(suffix[0].value)))
    suffix.shift()
  if (
    !suffix.length ||
    suffix.some(token => before.includes(escapeText(token.value)))
  )
    return before
  const prefix = source.slice(0, suffix[0].start)
  if (/\n[ \t]*\n/.test(source.trimEnd().slice(suffix[0].start))) return before
  const inline = profile === 'inline'
  const trailingNewlines =
    source.match(/(?:\r?\n[ \t]*)+$/)?.[0].match(/\n/g)?.length ?? 0
  const trailingBlanks = inline
    ? ''
    : '<br>\n'.repeat(Math.max(0, trailingNewlines - 2))
  const separator = inline ? ' ' : '<br>\n'
  const content = suffix.map(token => escapeText(token.value)).join(separator)
  if (!prefix.trim() && !before.trim())
    return inline ? content : `<p>${content}</p>\n` + trailingBlanks
  const softbreak = /\r?\n$/.test(prefix) && !/(?: {2,}|\\)\r?\n$/.test(prefix)
  const appended = (softbreak ? separator : '') + content
  if (inline) return before + appended
  return before.replace(
    /<\/p>(\n*)$/,
    (_match, newline: string) => appended + '</p>' + newline + trailingBlanks
  )
}

/** Normalize only output changes supported by the original link notation. */
export function normalizeLinkPolicy(row: LinkRow, origin?: string) {
  const { source, before, after } = row
  if (
    !source ||
    before.kind !== after.kind ||
    before.kind === 'error' ||
    after.kind === 'error' ||
    /`|~~~|\$|<a\b/i.test(source)
  )
    return undefined
  const domains = [
    ...new Set(
      [...source.matchAll(/<([^<>\s]+)>/g)]
        .map(match => match[1])
        .filter(
          value =>
            completedDomain(value) && sourceForm(source, value) === 'angle'
        )
    )
  ]
  if (before.kind === 'html') {
    if (
      !/<a\b/i.test(before.value + after.value) &&
      !domains.length &&
      (!origin || !source.includes(origin))
    )
      return undefined
    const right = normalizeHtml(after.value, source, domains, 'after', origin)
    if (
      right === undefined ||
      domains.some(
        domain =>
          right.forced.get(domain) !== source.split(`<${domain}>`).length - 1
      )
    )
      return undefined
    const left = normalizeHtml(before.value, source, domains, 'before', origin)
    if (left === undefined || right === undefined) return undefined
    return {
      before: restoreResourceSuffix(left.value, source, row.profile, origin),
      after: right.value
    }
  }
  let left = before.value
  const right = after.value
  for (const domain of domains) {
    left = left.replaceAll(`<${domain}>`, domain)
  }
  for (const match of source.matchAll(/(?:https?:\/\/|ftp:\/\/)[^\s<>]+/g)) {
    const url = match[0]
    if (sourceForm(source, url) !== 'bare') continue
    const label = resourceLabel(url, origin)
    if (label) left = left.replace(`[${label}]`, url)
    try {
      left = left.replaceAll(decodeURI(url), url)
    } catch {
      /* Retain malformed escapes. */
    }
  }
  return { before: left, after: right }
}
