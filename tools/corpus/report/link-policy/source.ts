import { decodeHTML } from 'entities'
import { parseFragment } from 'parse5'
import punycode from 'punycode/punycode.js'

import { bareUrl, expectedBareUrl } from '../url-boundaries.ts'
import {
  automaticDestination,
  bareLink,
  completedDomain
} from './destinations.ts'

const { toASCII } = punycode
export type SourceForm = 'bare' | 'angle' | undefined

export type SourceForms = (
  label: string,
  literalHtml?: boolean,
  stamp?: string
) => SourceForm

export type RetainedLink = (
  label: string,
  href: string,
  notation: string
) => boolean

const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function sourceForm(
  source: string,
  label: string,
  literalHtml = false,
  retained?: RetainedLink,
  completeBoundary = false
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

      for (const spelling of [
        encoded,
        canonical,
        canonical.replace(/\/$/, '')
      ]) {
        if (spelling !== label && source.includes(spelling)) {
          return sourceForm(
            source,
            spelling,
            literalHtml,
            retained,
            completeBoundary
          )
        }
      }
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
    ) {
      return undefined
    }

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
        ) {
          return undefined
        }
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
            : /[a-z0-9+]/i
        ).test(previous) &&
          !schemePrefix) ||
        (!completeBoundary &&
          (email
            ? /^(?:[\p{L}\p{N}_-]|\.[\p{L}\p{N}-])/u
            : /^(?:[a-z0-9_/@#?%-]|\.[a-z0-9-])/i
          ).test(following))
      ) {
        return undefined
      }
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

export interface LinkEvidence {
  formOf: SourceForms
  domains: readonly string[]
  unchanged: ReadonlyMap<string, number>
  spellingOf(label: string): string
  boundaryOf(label: string): string | null | undefined
}

export function collectLinkEvidence(
  source: string,
  before: string,
  after: string,
  html: boolean
): LinkEvidence {
  const anchors = (html: string) => {
    const counts = new Map<string, number>()

    for (const [anchor] of html.matchAll(/<a\b[^>]*>[^<]*<\/a\s*>/gi)) {
      counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
    }

    return counts
  }

  const unchanged = html ? anchors(before) : new Map<string, number>()

  const afterAnchors = anchors(after)

  for (const [anchor, count] of unchanged) {
    unchanged.set(anchor, afterAnchors.get(anchor) === count ? count : 0)
  }

  let retainedAnchors:
    { label: string; href: string; count: number }[] | undefined

  const retained: RetainedLink = (label, href, notation) => {
    retainedAnchors ??= [...unchanged].flatMap(([html, count]) => {
      const node = parseFragment(html).childNodes[0]
      if (!count || !node || !('tagName' in node) || node.tagName !== 'a') {
        return []
      }

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

    if (
      !source.includes(label) &&
      /[^\p{ASCII}]/u.test(label) &&
      !/[\s<>@]/.test(label)
    ) {
      const end = label.search(/[/?#]/)
      const authority = end < 0 ? label : label.slice(0, end)
      const encoded = toASCII(authority) + (end < 0 ? '' : label.slice(end))
      if (source.includes(encoded)) spelling = encoded
    }

    if (
      !source.includes(label) &&
      (completedDomain(label, false) || bareUrl(label))
    ) {
      try {
        const encoded = encodeURI(label).replace(/%25([0-9a-f]{2})/gi, '%$1')

        const pattern = escapePattern(encoded).replace(
          /%([0-9a-f])([0-9a-f])/gi,
          (_all, a: string, b: string) =>
            `%[${a.toLowerCase()}${a.toUpperCase()}][${b.toLowerCase()}${b.toUpperCase()}]`
        )

        spelling = source.match(new RegExp(pattern))?.[0] ?? spelling
      } catch {
        /* Invalid URI sequences remain unchanged. */
      }
    }

    spellings.set(label, spelling)
    return spelling
  }

  const boundaries = new Map<string, string | null | undefined>()

  const boundaryOf = (label: string) => {
    if (!boundaries.has(label)) {
      boundaries.set(label, expectedBareUrl(source, spellingOf(label)))
    }

    return boundaries.get(label)
  }

  const forms = new Map<string, SourceForm>()

  const formOf: SourceForms = (label, literalHtml = false, stamp) => {
    const key = (literalHtml ? '1' : '0') + (stamp ?? '') + '\0' + label
    if (forms.has(key)) return forms.get(key)

    const form = sourceForm(
      stamp ? source.replaceAll(stamp + label, ' ' + label) : source,
      spellingOf(label),
      literalHtml,
      retained,
      bareUrl(label) && boundaryOf(label) === spellingOf(label)
    )

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

  return { formOf, domains, unchanged, spellingOf, boundaryOf }
}
