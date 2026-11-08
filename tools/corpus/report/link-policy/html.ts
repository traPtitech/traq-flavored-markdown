import { decodeHTML, escapeText } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

import type { ClassificationId } from '../../protocol/classification.ts'
import { type HtmlEdit, applyHtmlEdits } from '../edits.ts'
import { bareUrl } from '../url-boundaries.ts'
import {
  automaticDestination,
  bareEmailPattern,
  bareLink,
  completedDomain,
  legacyBareDestination,
  resourceLabel
} from './destinations.ts'
import { trailingStamp } from './resources.ts'
import type { LinkEvidence, SourceForm } from './source.ts'

interface LinkHtmlContext {
  evidence: LinkEvidence
  side: 'before' | 'after'
  origin?: string
  expectedLinks?: ReadonlyMap<string, number>
}

export interface LinkHtmlResult {
  value: string
  forced: ReadonlyMap<string, number>
  angleText: ReadonlyMap<string, number>
  linked: ReadonlyMap<string, number>
  urls: ReadonlyMap<string, string>
  changes: ReadonlySet<ClassificationId>
}

const literalContexts = new Set(
  'code pre script style textarea title listing xmp iframe noembed noframes plaintext template'.split(
    ' '
  )
)

const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function normalizeLinkHtml(
  value: string,
  { evidence, side, origin, expectedLinks }: LinkHtmlContext
): LinkHtmlResult | undefined {
  const {
    formOf,
    domains,
    unchanged: unchangedLinks,
    spellingOf,
    boundaryOf
  } = evidence

  const changes = new Set<ClassificationId>()
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
  const edits: HtmlEdit[] = []
  const forced = new Map<string, number>()
  const angleText = new Map<string, number>()
  const linked = new Map<string, number>()
  const urls = new Map<string, string>()

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
      ) {
        continue
      }

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
        ) {
          continue
        }

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

          let form: SourceForm | 'literal' =
            literalAttribute && side === 'before'
              ? 'literal'
              : formOf(
                  label,
                  literalHtml,
                  label.startsWith('//') ? trailingStamp(prefix) : undefined
                )

          const boundary = bareUrl(label) ? boundaryOf(label) : undefined
          const expected = typeof boundary === 'string' ? boundary : undefined

          if (
            side === 'before' &&
            !form &&
            expected &&
            expected.startsWith(spellingOf(label)) &&
            /^[_-]+$/.test(expected.slice(spellingOf(label).length)) &&
            expectedLinks?.has(expected) &&
            formOf(expected) === 'bare'
          ) {
            form = 'bare'
          }

          const bracketed =
            bareUrl(label) && decodeHTML(prefix.slice(-40)).endsWith('[')

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
            (side === 'before' ||
              form !== 'bare' ||
              !bareUrl(label) ||
              (!bracketed &&
                boundary !== null &&
                (!expected || expected === spellingOf(label)))) &&
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
            ) {
              replacement = escapeText(spellingOf(label))
            }

            if (form === 'angle') {
              forced.set(label, (forced.get(label) ?? 0) + 1)
            } else if (form !== 'literal' && (legacyEmail || bareLink(label))) {
              if (bareUrl(label)) urls.set(label, spellingOf(label))

              if (!bracketed) {
                const key = legacyEmail ?? expected ?? label
                linked.set(key, (linked.get(key) ?? 0) + 1)
              }
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
            changes.add(
              form === 'angle'
                ? 'link.angle'
                : label.startsWith('//') || resource
                  ? 'link.relative'
                  : bareEmailPattern.test(label) || legacyEmail
                    ? 'link.email'
                    : legacyBare || (!bareLink(label) && side === 'before')
                      ? 'link.domain'
                      : bracketed ||
                          (boundary !== undefined &&
                            boundary !== spellingOf(label))
                        ? 'link.boundary'
                        : 'link.url'
            )

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

      if (text !== value.slice(location.startOffset, location.endOffset)) {
        edits.push({
          start: location.startOffset,
          end: location.endOffset,
          value: text
        })
      }
    }

    if ('childNodes' in node) pending.push(...node.childNodes)
  }

  const normalized = applyHtmlEdits(value, edits)

  return normalized === undefined
    ? undefined
    : { value: normalized, forced, angleText, linked, urls, changes }
}
