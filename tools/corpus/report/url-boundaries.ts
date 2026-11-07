import { escapeText } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

export const bareUrl = (value: string) =>
  /^(?:(?:https?|ftp):\/\/|\/\/)/i.test(value)

const hostLetter = '[^\\p{P}\\p{Z}\\p{C}<>｜]'
const hostPart = `${hostLetter}(?:(?:${hostLetter}|-)*${hostLetter})?`

const authority = new RegExp(
  `^(?:(?:https?|ftp):\\/\\/|\\/\\/)(?:[^\\p{White_Space}@/\\[\\]()<>]{1,50}@)?(?:${hostPart}(?:\\.${hostPart})*|\\[[0-9a-f:.]+\\])(?<port>:[0-9]{1,5})?`,
  'iu'
)

const terminator = /^[\p{P}\p{Z}\p{C}<>｜]/u

// Independently verify the accepted bare-URL boundary rules. This is deliberately
// limited to automatic URLs; explicit destinations and mail addresses bypass it.
function boundary(value: string) {
  const matched = authority.exec(value)
  if (!matched) return undefined

  const start = matched[0].length
  const following = value.slice(start)

  const proseAfterPort =
    Boolean(matched.groups?.port) && following.charCodeAt(0) > 0x7f

  const afterDots = following.replace(/^\.+/, '')

  const invalidDotSuffix =
    following.startsWith('.') &&
    (afterDots.startsWith('-') ||
      (afterDots.length > 0 && !terminator.test(afterDots)))
  if (
    (following.length > 0 && !terminator.test(following) && !proseAfterPort) ||
    /^[-_]/.test(following) ||
    invalidDotSuffix
  ) {
    return undefined
  }

  // Hosts and ports have their own lexical boundary. In particular, Japanese
  // prose after a port is outside the URL even without a separating space.
  if (!/^[/?#]/.test(following)) return matched[0]

  const pairs: { close: string; open: number }[] = []
  let end = start
  let quotedUntil = 0

  for (let position = end; position < value.length;) {
    const ch = String.fromCodePoint(value.codePointAt(position)!)

    if (ch === '(') pairs.push({ close: ')', open: position })
    else if (ch === ')') {
      if (pairs.at(-1)?.close !== ')') break

      pairs.pop()
    }

    if (position >= quotedUntil) {
      if (/[\p{White_Space}\p{Cc}<>｜]/u.test(ch)) break

      if (ch === '"' || ch === "'") {
        const tail = value.slice(position + 1)

        const close = tail.search(
          ch === '"' ? /["\p{White_Space}\p{Cc}]/u : /['\p{White_Space}\p{Cc}]/u
        )

        if (close > 0 && tail[close] === ch) quotedUntil = position + close + 2
        else if (ch === '"' || !/^[\p{L}\p{N}-]/u.test(tail)) break
      }

      if (ch === '[' || ch === '{') {
        pairs.push({ close: ch === '[' ? ']' : '}', open: position })
      } else if (ch === ']' || ch === '}') {
        if (pairs.at(-1)?.close !== ch) break

        pairs.pop()
      }
    }

    end = position + ch.length
    position = end
  }

  if (pairs.length) end = pairs[0].open

  while (end > start && '?!.,:*~;'.includes(value[end - 1])) {
    if (value[end - 1] === ';') {
      let start = end - 1
      while (start > 0 && /[a-z0-9]/i.test(value[start - 1])) start--

      if (start < end - 1 && value[start - 1] === '&') {
        end = start - 1
        continue
      }
    }

    end--
  }

  if (end === start + 1 && value[start] !== '/') end = start

  return value.slice(0, end)
}

/** Ambiguous occurrences stay visible instead of guessing which URL changed. */
export function expectedBareUrl(source: string, label: string) {
  if (!bareUrl(label)) return undefined

  const expected = new Set<string>()
  let offset = 0

  while ((offset = source.indexOf(label, offset)) >= 0) {
    const value = boundary(source.slice(offset))
    if (value) expected.add(value)

    offset += label.length
  }

  return expected.size > 1
    ? null
    : expected.size === 1
      ? [...expected][0]
      : undefined
}

const protectedTags = new Set(
  'a code pre script style textarea title listing xmp iframe noembed noframes plaintext template'.split(
    ' '
  )
)

const decorations = [
  ['~~', 's'],
  ['**', 'strong'],
  ['__', 'strong'],
  ['*', 'em'],
  ['_', 'em']
] as const

/** Restore only source-backed formatting exposed by a changed automatic URL. */
export function normalizeUrlFormatting(
  source: string,
  before: string,
  after: string,
  urls: ReadonlyMap<string, string>
) {
  const replacements = new Map<string, string>()

  for (const [url, spelling] of urls) {
    for (const [marker, tag] of decorations) {
      if (!url.endsWith(marker)) continue

      const literal = marker + url
      if (!source.includes(marker + spelling)) continue

      const body = url.slice(0, -marker.length)
      const rendered = `<${tag}>${escapeText(body)}</${tag}>`

      if (before.includes(rendered) || after.includes(rendered)) {
        replacements.set(escapeText(literal), rendered)
      }
    }

    const rendered = escapeText(url).replace(
      /(__|\*\*|~~)([^<>]+?)\1/g,
      (_all, marker: string, body: string) => {
        const tag = marker === '~~' ? 's' : 'strong'
        return `<${tag}>${body}</${tag}>`
      }
    )

    if (
      rendered !== escapeText(url) &&
      source.includes(spelling) &&
      (before.includes(rendered) || after.includes(rendered))
    ) {
      replacements.set(escapeText(url), rendered)
    }
  }

  if (!replacements.size) return { before, after }

  const rewrite = (html: string) => {
    let invalid = false

    const fragment = parseFragment(html, {
      sourceCodeLocationInfo: true,

      onParseError: () => {
        invalid = true
      }
    })

    if (invalid) return html

    const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
    const edits: { start: number; end: number; value: string }[] = []

    while (pending.length) {
      const node = pending.pop()!
      if (
        'tagName' in node &&
        (protectedTags.has(node.tagName) ||
          node.attrs.some(
            attr =>
              attr.name === 'class' &&
              /(?:^|\s)katex(?:-|\s|$)/.test(attr.value)
          ))
      ) {
        continue
      }

      if ('value' in node && node.sourceCodeLocation) {
        const { startOffset: start, endOffset: end } = node.sourceCodeLocation
        let value = html.slice(start, end)
        // Repaired/merged text ranges must never rewrite intervening tags or
        // their attribute values as if they were literal URL text.
        if (value.includes('<')) continue

        for (const [literal, rendered] of replacements) {
          value = value.replaceAll(literal, rendered)
        }

        if (value !== html.slice(start, end)) edits.push({ start, end, value })
      }

      if ('childNodes' in node) pending.push(...node.childNodes)
    }

    edits.sort((left, right) => right.start - left.start)

    for (const edit of edits) {
      html = html.slice(0, edit.start) + edit.value + html.slice(edit.end)
    }

    return html
  }

  return { before: rewrite(before), after: rewrite(after) }
}
