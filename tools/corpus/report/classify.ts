import { escapeAttribute } from 'entities'
import { diffStringsRaw } from 'jest-diff'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

import type {
  Classification,
  ClassificationId
} from '../protocol/classification.ts'
import type { DifferenceRow } from '../protocol/comparison.ts'
import {
  filterCombinations,
  filterResultBit,
  selectedFilters
} from '../protocol/filters.ts'
import { type HtmlEdit, applyHtmlEdits } from './edits.ts'
import { differenceFilterMask, normalizeLinkedImages } from './filter.ts'
import { normalizeHtmlSerialization } from './html.ts'
import { normalizeKatexErrors } from './katex.ts'
import { normalizeLinkPolicy } from './link-policy.ts'
import { normalizeNestedLinks } from './nested-links.ts'

const withoutWhitespace = (value: string) => value.replace(/[ \t\r\n\f]/g, '')

const literalElements = new Set([
  'code',
  'pre',
  'script',
  'style',
  'textarea',
  'title',
  'template',
  'svg',
  'math'
])

/** Only inspect authored, explicitly closed elements; never execute outputs. */
function rewriteElements(
  source: string,
  rewrite: (
    node: DefaultTreeAdapterTypes.Element,
    opening: string,
    body: string
  ) => string | undefined
) {
  let invalid = false

  const fragment = parseFragment(source, {
    sourceCodeLocationInfo: true,

    onParseError: () => {
      invalid = true
    }
  })

  if (invalid) return undefined

  const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
  const edits: HtmlEdit[] = []

  while (pending.length) {
    const node = pending.pop()!

    if ('tagName' in node) {
      if (literalElements.has(node.tagName)) continue

      const location = node.sourceCodeLocation

      if (location?.startTag && (location.endTag || node.tagName === 'br')) {
        const opening = source.slice(
          location.startTag.startOffset,
          location.startTag.endOffset
        )

        const body = location.endTag
          ? source.slice(
              location.startTag.endOffset,
              location.endTag.startOffset
            )
          : ''

        const value = rewrite(node, opening, body)

        if (value !== undefined) {
          edits.push({
            start: location.startOffset,
            end: location.endOffset,
            value
          })

          continue
        }
      }
    }

    if ('childNodes' in node) pending.push(...node.childNodes)
  }

  return applyHtmlEdits(source, edits)
}

function colorSpelling(source: string, hsl: boolean) {
  return rewriteElements(source, (node, opening, body) => {
    const classes =
      node.attrs.find(a => a.name === 'class')?.value.split(/\s+/) ?? []

    const title = node.attrs.find(a => a.name === 'title')?.value ?? ''
    if (
      node.tagName !== 'i' ||
      !classes.includes('message-emoji') ||
      !/^:(?:0x[\da-f]+|hsl\([^)]*\)):$/i.test(title)
    ) {
      return undefined
    }

    const value = opening + body + '</i>'

    return hsl
      ? value.replace(/hsl\([^)]*\)/gi, match => match.replace(/\s+/g, ''))
      : value.replace(/(?:0x|#)[\da-f]+/gi, match => match.toLowerCase())
  })
}

function withoutElements(source: string, names: readonly string[]) {
  let result = source

  for (let i = 0; i < 8; i++) {
    const next = rewriteElements(result, (node, _opening, body) =>
      names.includes(node.tagName) && !node.attrs.length ? body : undefined
    )
    if (next === undefined) return undefined
    if (next === result) return result

    result = next
  }

  return result
}

function distance(before: string, after: string) {
  if (before === after) return 0

  let start = 0,
    end = 0

  const length = Math.min(before.length, after.length)
  while (start < length && before[start] === after[start]) start++

  while (
    end < length - start &&
    before[before.length - end - 1] === after[after.length - end - 1]
  ) {
    end++
  }

  before = before.slice(start, before.length - end)
  after = after.slice(start, after.length - end)
  // Large outputs retain residuals unless an existing exact filter proves equality.
  if (before.length + after.length > 12000) return Infinity

  return diffStringsRaw(before, after, false).reduce(
    (sum, part) => sum + (part[0] ? part[1].length : 0),
    0
  )
}

function inlineImages(source: string) {
  return rewriteElements(source, (node, _opening, body) => {
    if (
      node.tagName !== 'a' ||
      !node.attrs.some(a => a.name === 'data-is-image' && a.value === '') ||
      node.attrs.some(a => !['href', 'title', 'data-is-image'].includes(a.name))
    ) {
      return undefined
    }

    const href = node.attrs.find(a => a.name === 'href')?.value
    if (href === undefined) return undefined

    const title = node.attrs.find(a => a.name === 'title')?.value

    return (
      '!<a href="' +
      escapeAttribute(href) +
      '" target="_blank" rel="nofollow noopener noreferrer"' +
      (title === undefined ? '' : ' title="' + escapeAttribute(title) + '"') +
      '>' +
      body +
      '</a>'
    )
  })
}

function rewritePlainText(
  source: string,
  transform: (value: string) => string
) {
  let invalid = false

  const fragment = parseFragment(source, {
    sourceCodeLocationInfo: true,

    onParseError: () => {
      invalid = true
    }
  })

  if (invalid) return undefined

  const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
  const edits: HtmlEdit[] = []

  while (pending.length) {
    const node = pending.pop()!
    if (
      'tagName' in node &&
      (literalElements.has(node.tagName) || ['a', 'i'].includes(node.tagName))
    ) {
      continue
    }

    if ('value' in node && node.sourceCodeLocation) {
      const { startOffset: start, endOffset: end } = node.sourceCodeLocation
      const value = transform(source.slice(start, end))
      if (value !== source.slice(start, end)) edits.push({ start, end, value })
    }

    if ('childNodes' in node) pending.push(...node.childNodes)
  }

  return applyHtmlEdits(source, edits)
}

const combinations = [...filterCombinations].sort(
  (a, b) => selectedFilters(a).length - selectedFilters(b).length || b - a
)

/** Classify saved before/after bytes. No current renderer or message IDs are used. */
export function classifyDifference(
  row: DifferenceRow,
  origin?: string,
  knownMask?: bigint
): Classification {
  const tags = new Set<ClassificationId>()

  if (row.before.kind === 'error' || row.after.kind === 'error') {
    tags.add(
      row.before.kind === 'error'
        ? row.after.kind === 'error'
          ? 'error.changed'
          : 'error.before'
        : 'error.after'
    )

    return { tags: [...tags], complete: true }
  }

  if (row.before.kind !== row.after.kind) {
    return { tags: ['error.kind'], complete: true }
  }

  let before = row.before.value,
    after = row.after.value

  const apply = (
    tag: ClassificationId,
    left: string | undefined,
    right: string | undefined
  ) => {
    if (
      left === undefined ||
      right === undefined ||
      (left === before && right === after)
    ) {
      return
    }

    if (distance(left, right) < distance(before, after)) {
      tags.add(tag)
      before = left
      after = right
    }
  }

  const currentRow = (): DifferenceRow => ({
    ...row,
    before: { kind: row.before.kind, value: before },
    after: { kind: row.after.kind, value: after }
  })

  if (row.before.kind === 'html') {
    if (/message-emoji/.test(before + after)) {
      apply(
        'stamp.hex_case',
        colorSpelling(before, false),
        colorSpelling(after, false)
      )

      apply(
        'stamp.hsl_spaces',
        colorSpelling(before, true),
        colorSpelling(after, true)
      )
    }

    if (withoutWhitespace(before) !== withoutWhitespace(after)) {
      const inline = row.profile === 'inline'

      apply(
        inline ? 'image.inline_linked' : 'image.linked',
        normalizeLinkedImages(before, inline),
        normalizeLinkedImages(after, inline)
      )

      if (inline) {
        apply('image.inline', inlineImages(before), inlineImages(after))

        if ((row.source.match(/^\s*\d+[.)]\s+/gm)?.length ?? 0) >= 2) {
          apply(
            'block.numbering',
            rewritePlainText(before, value =>
              value.replace(/\b\d+[.)](?=[ \t])/g, '#.')
            ),
            rewritePlainText(after, value =>
              value.replace(/\b\d+[.)](?=[ \t])/g, '#.')
            )
          )
        }
      }

      const nested = normalizeNestedLinks(currentRow())
      if (nested) apply('reference.nested', nested.before, nested.after)

      const links = normalizeLinkPolicy(currentRow(), origin)

      if (links) {
        apply('link.policy', links.before, links.after)

        if (tags.has('link.policy') && links.changes.length) {
          tags.delete('link.policy')
          for (const tag of links.changes) tags.add(tag)
        }
      }

      const left = normalizeKatexErrors(before),
        right = normalizeKatexErrors(after)

      if (left && right) {
        if (left.errors === right.errors && left.errors > 0) {
          apply('math.diagnostic', left.value, right.value)
        } else if (left.errors !== right.errors) {
          tags.add(
            left.errors < right.errors ? 'math.regression' : 'math.recovery'
          )
        }
      }

      apply(
        'html.serialization',
        normalizeHtmlSerialization(before),
        normalizeHtmlSerialization(after)
      )

      if (before !== after) {
        for (const [tag, names] of [
          ['block.breaks', ['br']],
          ['block.paragraph', ['p']],
          ['block.quote', ['blockquote']],
          ['block.list', ['ul', 'ol', 'li']],
          ['block.heading', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']]
        ] as const) {
          if (
            names.some(
              name => before.includes('<' + name) || after.includes('<' + name)
            )
          ) {
            apply(
              tag,
              withoutElements(before, names),
              withoutElements(after, names)
            )
          }
        }
      }
    }
  } else {
    const links = normalizeLinkPolicy(currentRow(), origin)
    if (links) apply('link.policy', links.before, links.after)
  }

  if (row.profile === 'inline' && row.before.kind === 'html') {
    apply(
      'text.inline_spacing',
      rewritePlainText(before, withoutWhitespace),
      rewritePlainText(after, withoutWhitespace)
    )
  }

  apply('text.whitespace', withoutWhitespace(before), withoutWhitespace(after))
  apply('text.case', before.toLowerCase(), after.toLowerCase())
  if (before === after && tags.size) return { tags: [...tags], complete: true }

  const mask = knownMask ?? differenceFilterMask(row, origin)

  const combination = combinations.find(value =>
    Boolean(mask & filterResultBit(value))
  )
  if (combination) {
    return {
      tags: selectedFilters(combination).map(filter => filter.classification),
      complete: true
    }
  }

  return { tags: [...tags], complete: false }
}
