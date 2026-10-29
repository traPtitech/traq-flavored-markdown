import { decodeHTML, escapeText } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'
import punycode from 'punycode/punycode.js'

import type { DifferenceRow } from '../protocol/comparison.ts'

const { toASCII } = punycode

type LinkRow = Pick<DifferenceRow, 'before' | 'after'> &
  Partial<Pick<DifferenceRow, 'source' | 'profile'>>
type Edit = { start: number; end: number; value: string }
type SourceForm = 'bare' | 'angle' | undefined
type SourceForms = (label: string, literalHtml?: boolean) => SourceForm
type RetainedLink = (label: string, href: string, notation: string) => boolean
const literalContexts = new Set(
  'code pre script style textarea title listing xmp iframe noembed noframes plaintext template'.split(
    ' '
  )
)
const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const bareEmailPattern =
  /^(?:mailto:)?[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i

function completedDomain(value: string, strict = true) {
  if (/[\s<>]/.test(value)) return false
  const authority = value.replace(/^\/\//, '').split(/[/?#]/, 1)[0]
  if (authority.includes('@') || !/^[^:]+(?::[0-9]{1,5})?$/.test(authority))
    return false
  try {
    const url = new URL(
      value.startsWith('//') ? 'https:' + value : 'https://' + value
    )
    return (
      url.hostname.includes('.') &&
      (!strict ||
        url.hostname
          .split('.')
          .every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)))
    )
  } catch {
    return false
  }
}

function bareLink(value: string) {
  if (/^(?:https?|ftp):\/\//i.test(value)) return true
  if (bareEmailPattern.test(value)) return true
  if (!value.startsWith('//')) return false
  try {
    const url = new URL('https:' + value)
    return url.hostname.startsWith('[') || completedDomain(value)
  } catch {
    return false
  }
}

function sourceForm(
  source: string,
  label: string,
  literalHtml = false,
  retained?: RetainedLink
): SourceForm {
  if (!label) return undefined
  // URL labels can be decoded while the authored URL uses percent escapes or
  // Punycode. Check the original spelling before applying context guards.
  if (!source.includes(label) && bareLink(label)) {
    try {
      const encoded = encodeURI(label).replace(/%25([0-9a-f]{2})/gi, '%$1')
      const url = new URL(label.startsWith('//') ? 'https:' + label : label)
      const canonical = label.startsWith('//')
        ? url.href.slice('https:'.length)
        : url.href
      for (const spelling of [encoded, canonical, canonical.replace(/\/$/, '')])
        if (spelling !== label && source.includes(spelling))
          return sourceForm(source, spelling, literalHtml, retained)
    } catch {
      return undefined
    }
  }
  let form: SourceForm
  let offset = 0
  while ((offset = source.indexOf(label, offset)) !== -1) {
    const prefix = source.slice(0, offset)
    const line = prefix.slice(prefix.lastIndexOf('\n') + 1)
    const lowerPrefix = prefix.toLowerCase()
    const rawAnchor = lowerPrefix.lastIndexOf('<a')
    if (
      !literalHtml &&
      rawAnchor > lowerPrefix.lastIndexOf('</a') &&
      /^<a\b/i.test(source.slice(rawAnchor)) &&
      /<\/a\s*>/i.test(source.slice(offset))
    ) {
      offset += label.length
      continue
    }
    // Keep opaque notation and reference definitions conservative.
    if (
      prefix.lastIndexOf('!{') > prefix.lastIndexOf('}') ||
      /^ {0,3}\[[^\]]+\]:/.test(line)
    )
      return undefined
    const destination = prefix.lastIndexOf('](')
    const insideDestination = destination > prefix.lastIndexOf(')')
    if (
      insideDestination ||
      prefix.lastIndexOf('[') > prefix.lastIndexOf(']')
    ) {
      const opening = (
        insideDestination ? prefix.slice(0, destination) : prefix
      ).lastIndexOf('[')
      const closing = insideDestination
        ? destination
        : source.indexOf(']', offset + label.length)
      if (opening < 0) return undefined
      const explicitLabel = source.slice(opening + 1, closing)
      const linked =
        insideDestination ||
        (closing >= 0 &&
          (/^[([]/.test(source.slice(closing + 1)) ||
            [...source.matchAll(/^ {0,3}\[([^\]\n]+)\]:/gm)].some(
              match =>
                match[1].trim().replace(/\s+/g, ' ').toLowerCase() ===
                explicitLabel.trim().replace(/\s+/g, ' ').toLowerCase()
            )))
      const target =
        /^\(\s*(?:<([^<>\n]+)>|([^\s()]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/.exec(
          source.slice(closing + 1)
        )
      const explicitDestination = target?.[1] ?? target?.[2]
      let distinctDestination = false
      if (explicitDestination) {
        try {
          new URL(explicitDestination)
          distinctDestination = !automaticDestination(
            explicitDestination,
            label,
            false,
            true
          )
        } catch {
          /* Relative or ambiguous destinations remain protected. */
        }
      }
      // A domain in an article title or destination does not make the separate
      // bare occurrence explicit. Retain ambiguous links whose rendered label
      // could itself equal this URL (including escapes and inline markup).
      const decoded = decodeHTML(explicitLabel).replace(
        /\\([^\p{L}\p{N}\s])/gu,
        '$1'
      )
      if (
        linked &&
        !distinctDestination &&
        (explicitLabel === label ||
          /[[\]<>!$]/.test(explicitLabel) ||
          decoded.trim() === label ||
          decoded.replace(/[*_~`=]/g, '').trim() === label)
      ) {
        if (
          !explicitDestination ||
          !target ||
          explicitLabel !== label ||
          !retained?.(
            label,
            explicitDestination,
            source.slice(opening, closing + 1 + target[0].length)
          )
        )
          return undefined
      }
      if (linked) {
        offset += label.length
        continue
      }
    }
    const angled = prefix.endsWith('<') && source[offset + label.length] === '>'
    if (!angled && bareLink(label)) {
      const previous = prefix.slice(-1)
      const following = source.slice(offset + label.length)
      const email = !label.startsWith('//') && !/^(?:https?|ftp):/i.test(label)
      const schemePrefix =
        label.startsWith('//') && /(?:^|[^a-z0-9])https?:$/i.test(prefix)
      if (
        ((email
          ? /[a-z0-9.!#$%&'*+/=?^_`{|}~@-]/i
          : label.startsWith('//')
            ? /[a-z0-9+\-/:;.&\\]/i
            : /[a-z0-9+-]/i
        ).test(previous) &&
          !schemePrefix) ||
        (email
          ? /^(?:[\p{L}\p{N}_-]|\.[\p{L}\p{N}-])/u
          : /^(?:[a-z0-9_/@#?%-]|\.[a-z0-9-])/i
        ).test(following)
      )
        return undefined
    }
    if (angled) {
      if (/^[a-z][a-z0-9+.-]{1,31}:/i.test(label) || !completedDomain(label)) {
        offset += label.length
        continue
      }
      form ??= 'angle'
    } else form = 'bare'
    offset += label.length
  }
  return form
}

function automaticDestination(
  href: string,
  label: string,
  forceHttps = false,
  before = false
) {
  let targets: string[]
  if (forceHttps)
    targets = [label.startsWith('//') ? 'https:' + label : 'https://' + label]
  else if (
    label.startsWith('//') &&
    (bareLink(label) || (before && completedDomain(label, false)))
  )
    targets = ['https:' + label]
  else if (/^mailto:/i.test(label)) targets = [label]
  else if (bareEmailPattern.test(label))
    targets = [
      'mailto:' + label,
      ...(before && completedDomain(label, false)
        ? ['http://' + label, 'https://' + label]
        : [])
    ]
  else if (completedDomain(label, !before))
    targets = ['http://' + label, 'https://' + label]
  else if (/^[a-z][a-z0-9+.-]*:/i.test(label)) targets = [label]
  else targets = []
  try {
    const actual = new URL(href.startsWith('//') ? 'https:' + href : href)
    return (
      ['http:', 'https:', 'ftp:', 'mailto:'].includes(actual.protocol) &&
      targets.some(target => {
        try {
          const encoded = encodeURI(target).replace(/%25([0-9a-f]{2})/gi, '%$1')
          const equivalent = (value: string) =>
            new URL(value).href.replace(/%[0-9a-f]{2}/gi, escape =>
              escape.toUpperCase()
            ) ===
            actual.href.replace(/%[0-9a-f]{2}/gi, escape =>
              escape.toUpperCase()
            )
          return equivalent(target) || equivalent(encoded)
        } catch {
          return false
        }
      })
    )
  } catch {
    return false
  }
}

/** The old renderer used raw Punycode rather than WHATWG host validation. */
function legacyBareDestination(href: string, label: string) {
  if (/[\s<>]/.test(label)) return false
  try {
    let expected: string
    if (/^mailto:/i.test(href)) {
      const parts = /^([^@]+)@([^@]+\.[^@]+)$/.exec(label)
      if (!parts || !/[^\p{ASCII}]/u.test(label)) return false
      expected = 'mailto:' + parts[1] + '@' + toASCII(parts[2])
    } else {
      const scheme =
        /^(https?):\/\//i.exec(href)?.[1] ??
        (href.startsWith('//') ? 'https' : undefined)
      if (!scheme || /^[a-z][a-z0-9+.-]*:/i.test(label)) return false
      const raw = label.replace(/^\/\//, '')
      const end = raw.search(/[/?#]/)
      const authority = end < 0 ? raw : raw.slice(0, end)
      const match = /^([^:@]+)(?::([0-9]{1,5}))?$/.exec(authority)
      if (
        !match ||
        !match[1].includes('.') ||
        match[1].split('.').some(part => !part || part.length > 63) ||
        (match[2] && Number(match[2]) > 65535)
      )
        return false
      expected =
        scheme +
        '://' +
        toASCII(match[1]) +
        (match[2] ? ':' + match[2] : '') +
        (end < 0 ? '' : raw.slice(end))
    }
    const canonical = (value: string) =>
      value
        .replace(
          /^(https?:\/\/)([^/?#]+)/i,
          (_all, scheme: string, authority: string) =>
            scheme.toLowerCase() + authority.toLowerCase()
        )
        .replace(/%[0-9a-f]{2}/gi, escape => escape.toUpperCase())
    const encoded = encodeURI(expected).replace(/%25([0-9a-f]{2})/gi, '%$1')
    return (
      canonical(encoded) ===
      canonical(href.startsWith('//') ? 'https:' + href : href)
    )
  } catch {
    return false
  }
}

function resourceLabel(value: string, origin?: string) {
  if (!origin) return undefined
  if (value.startsWith('//')) value = 'https:' + value
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
  formOf: SourceForms,
  domains: string[],
  side: 'before' | 'after',
  origin?: string,
  expectedLinks?: ReadonlyMap<string, number>,
  unchangedLinks?: ReadonlyMap<string, number>,
  spellingOf: (label: string) => string = label => label
) {
  const unchanged = new Map(unchangedLinks)
  const errors: number[] = []
  const fragment = parseFragment(value, {
    sourceCodeLocationInfo: true,
    onParseError: error => {
      errors.push(error.startOffset)
    }
  })
  if (errors.some(offset => offset < 0)) return undefined
  const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
  const edits: Edit[] = []
  const forced = new Map<string, number>()
  const angleText = new Map<string, number>()
  const linked = new Map<string, number>()
  while (pending.length) {
    const node = pending.pop()!
    if ('tagName' in node) {
      if (
        literalContexts.has(node.tagName) ||
        node.attrs.some(
          attr =>
            attr.name === 'class' &&
            attr.value.split(/\s+/).some(name => /^katex(?:-|$)/.test(name))
        )
      )
        continue
      if (node.tagName === 'a') {
        const location = node.sourceCodeLocation
        if (
          !location?.startTag ||
          !location.endTag ||
          errors.some(
            offset =>
              (offset >= location.startTag!.startOffset &&
                offset < location.startTag!.endOffset) ||
              (offset >= location.endTag!.startOffset &&
                offset < location.endTag!.endOffset)
          )
        )
          continue
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
          const original = value.slice(location.startOffset, location.endOffset)
          const common = unchanged.get(original) ?? 0
          if (common) {
            unchanged.set(original, common - 1)
            continue
          }
          const label = node.childNodes
            .map(child => ('value' in child ? child.value : ''))
            .join('')
          const prefix = value.slice(0, location.startTag.startOffset)
          const rawOpening = prefix.toLowerCase().lastIndexOf('&lt;a')
          const literalHtml =
            rawOpening > prefix.toLowerCase().lastIndexOf('&lt;/a') &&
            /^&lt;a\b/i.test(prefix.slice(rawOpening)) &&
            /&lt;\/a\s*&gt;/i.test(value.slice(location.endTag.endOffset))
          const literalAttribute =
            prefix.lastIndexOf('&lt;') > prefix.lastIndexOf('&gt;') &&
            /&lt;[a-z][a-z0-9:-]*\s[^<>]*$/i.test(prefix) &&
            value.slice(location.endTag.endOffset).includes('&gt;')
          if (literalAttribute && side === 'after') continue
          const form: SourceForm | 'literal' =
            literalAttribute && side === 'before'
              ? 'literal'
              : formOf(label, literalHtml)
          const resource = resourceLabel(href, origin)
          const legacyBare =
            side === 'before' &&
            form &&
            form !== 'angle' &&
            !bareLink(label) &&
            legacyBareDestination(href, label)
          const legacyEmail =
            side === 'before' &&
            form === 'bare' &&
            label.includes('@') &&
            !bareEmailPattern.test(label)
              ? [...(expectedLinks?.keys() ?? [])].find(
                  email =>
                    bareEmailPattern.test(email) &&
                    !email.startsWith('mailto:') &&
                    label.endsWith(email) &&
                    automaticDestination(href, 'mailto:' + label)
                )
              : undefined
          let replacement: string | undefined
          if (
            form &&
            (side === 'before' || form === 'angle' || bareLink(label)) &&
            (form === 'angle' ||
              bareLink(label) ||
              (side === 'before' && completedDomain(label, false)) ||
              legacyEmail ||
              legacyBare) &&
            (side === 'before' || !href.startsWith('//')) &&
            (form !== 'angle' || domains.includes(label)) &&
            (legacyBare ||
              legacyEmail ||
              automaticDestination(
                href,
                label,
                side === 'after' && form === 'angle',
                side === 'before'
              ))
          ) {
            replacement = value.slice(
              location.startTag.endOffset,
              location.endTag.startOffset
            )
            if (
              side === 'before' &&
              form === 'bare' &&
              !bareLink(label) &&
              spellingOf(label) !== label
            )
              replacement = escapeText(spellingOf(label))
            if (form === 'angle')
              forced.set(label, (forced.get(label) ?? 0) + 1)
            else if (form !== 'literal' && (legacyEmail || bareLink(label))) {
              const key = legacyEmail ?? label
              linked.set(key, (linked.get(key) ?? 0) + 1)
            }
          } else if (
            resource &&
            (side === 'before' || !href.startsWith('//')) &&
            [`[${resource}]`, `[[${resource}]]`].includes(label)
          ) {
            const raw = [href, href.replace(/^https:/i, '')].find(
              raw => bareLink(raw) && formOf(raw) === 'bare'
            )
            if (raw && automaticDestination(href, raw)) {
              replacement = escapeText(raw)
              linked.set(raw, (linked.get(raw) ?? 0) + 1)
            }
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
          `(?:&(?:lt|LT);|&#0*60;|&#[xX]0*3[cC];)${escapePattern(escapeText(domain))}(?:&(?:gt|GT);|&#0*62;|&#[xX]0*3[eE];)`,
          'g'
        )
        text = text.replace(pattern, () => {
          angleText.set(domain, (angleText.get(domain) ?? 0) + 1)
          return escapeText(domain)
        })
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
  return { value: parts.join(''), forced, angleText, linked }
}

function restoreResourceSuffix(
  html: string,
  source: string,
  profile: LinkRow['profile'],
  origin?: string
) {
  const tokens = [...source.trimEnd().matchAll(/\S+/g)].flatMap(token => {
    const relative = /(?<![:/\w])\/\/[^\s<>]+$/.exec(token[0])
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
      !token[0].startsWith('//') ||
      !resourceLabel(token[0], origin) ||
      sourceForm(source, token[0]) !== 'bare'
    )
      break
    suffix.unshift({ value: token[0], start: token.index })
  }
  while (suffix.length && html.includes(escapeText(suffix[0].value)))
    suffix.shift()
  if (
    !suffix.length ||
    suffix.some(token => html.includes(escapeText(token.value)))
  )
    return html
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
  if (!prefix.trim() && !html.trim())
    return inline ? content : `<p>${content}</p>\n` + trailingBlanks
  const softbreak = /\r?\n$/.test(prefix) && !/(?: {2,}|\\)\r?\n$/.test(prefix)
  const appended = (softbreak ? separator : '') + content
  if (inline) return html + appended
  if (/\n[ \t]*\n$/.test(prefix) && /<p><\/p>\n*$/.test(html))
    return html.replace(
      /<p><\/p>(\n*)$/,
      (_all, newline: string) => `<p>${content}</p>` + newline + trailingBlanks
    )
  return html.replace(
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
    (before.kind === 'text' && /`|~~~|\$/.test(source))
  )
    return undefined
  const anchors = (html: string) => {
    const counts = new Map<string, number>()
    for (const [anchor] of html.matchAll(/<a\b[^>]*>[^<]*<\/a\s*>/gi))
      counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
    return counts
  }
  const unchanged =
    before.kind === 'html' ? anchors(before.value) : new Map<string, number>()
  const afterAnchors = anchors(after.value)
  for (const [anchor, count] of unchanged)
    unchanged.set(anchor, afterAnchors.get(anchor) === count ? count : 0)
  let retainedAnchors:
    { label: string; href: string; count: number }[] | undefined
  const retained: RetainedLink = (label, href, notation) => {
    retainedAnchors ??= [...unchanged].flatMap(([html, count]) => {
      const node = parseFragment(html).childNodes[0]
      if (!count || !node || !('tagName' in node) || node.tagName !== 'a')
        return []
      const target = node.attrs.find(attr => attr.name === 'href')?.value
      return target
        ? [
            {
              label: node.childNodes
                .map(child => ('value' in child ? child.value : ''))
                .join(''),
              href: target,
              count
            }
          ]
        : []
    })
    const count = retainedAnchors
      .filter(
        anchor => anchor.label === label && anchor.href === decodeHTML(href)
      )
      .reduce((sum, anchor) => sum + anchor.count, 0)
    return count >= source.split(notation).length - 1
  }
  const spellings = new Map<string, string>()
  const spellingOf = (label: string) => {
    const cached = spellings.get(label)
    if (cached !== undefined) return cached
    let spelling = label
    if (!source.includes(label) && completedDomain(label, false)) {
      try {
        const encoded = encodeURI(label).replace(/%25([0-9a-f]{2})/gi, '%$1')
        const pattern = escapePattern(encoded).replace(
          /%([0-9a-f])([0-9a-f])/gi,
          (_all, a: string, b: string) =>
            `%[${a.toLowerCase()}${a.toUpperCase()}][${b.toLowerCase()}${b.toUpperCase()}]`
        )
        spelling = source.match(new RegExp(pattern))?.[0] ?? label
      } catch {
        /* Invalid URI sequences remain unchanged. */
      }
    }
    spellings.set(label, spelling)
    return spelling
  }
  const forms = new Map<string, SourceForm>()
  const formOf: SourceForms = (label, literalHtml = false) => {
    const key = (literalHtml ? '1' : '0') + label
    if (forms.has(key)) return forms.get(key)
    const form = sourceForm(source, spellingOf(label), literalHtml, retained)
    forms.set(key, form)
    return form
  }
  const domains = [
    ...new Set(
      [...source.matchAll(/<([^<>\s]+)>/g)]
        .map(match => match[1])
        .filter(value => completedDomain(value) && formOf(value) === 'angle')
    )
  ]
  if (before.kind === 'html') {
    if (
      !/<a\b/i.test(before.value + after.value) &&
      !domains.length &&
      (!origin || !source.includes(origin))
    )
      return undefined
    // Identical anchors need no interpretation. Keeping them on both sides also
    // prevents an unrelated occurrence in literal HTML from being normalized
    // on only one side. Counts matter when a label occurs more than once.
    const right = normalizeHtml(
      after.value,
      formOf,
      domains,
      'after',
      origin,
      undefined,
      unchanged,
      spellingOf
    )
    if (right === undefined) return undefined
    const left = normalizeHtml(
      before.value,
      formOf,
      domains,
      'before',
      origin,
      right.linked,
      unchanged,
      spellingOf
    )
    if (
      left === undefined ||
      domains.some(
        domain =>
          (right.forced.get(domain) ?? 0) <
          (left.forced.get(domain) ?? 0) + (left.angleText.get(domain) ?? 0)
      )
    )
      return undefined
    const restored = restoreResourceSuffix(
      right.value,
      source,
      row.profile,
      origin
    )
    for (const [label, count] of left.linked)
      if (
        (right.linked.get(label) ?? 0) < count &&
        !(restored !== right.value && restored.includes(escapeText(label)))
      )
        return undefined
    return { before: left.value, after: restored }
  }
  let left = before.value
  const right = after.value
  for (const domain of domains) {
    left = left.replaceAll(`<${domain}>`, domain)
  }
  let normalizedRight = right
  for (const match of source.matchAll(/(?<![:/\w])\/\/[^\s<>]+/g)) {
    const url = match[0]
    if (formOf(url) !== 'bare') continue
    const label = resourceLabel(url, origin)
    if (label) normalizedRight = normalizedRight.replace(`[${label}]`, url)
  }
  return { before: left, after: normalizedRight }
}
