import { escapeAttribute } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

import { type HtmlEdit, applyHtmlEdits } from './edits.ts'

const htmlNamespace = 'http://www.w3.org/1999/xhtml'

const literalContexts = new Set([
  'code',
  'pre',
  'script',
  'style',
  'textarea',
  'title',
  'listing',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
  'template'
])

/** Erase only diagnostic text from explicitly closed KaTeX error wrappers. */
export function normalizeKatexErrors(source: string) {
  if (!source.includes('katex-error')) return { value: source, errors: 0 }

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
      if (literalContexts.has(node.tagName)) continue

      const classes =
        node.attrs
          .find(attribute => attribute.name === 'class')
          ?.value.split(/[ \t\r\n\f]+/) ?? []

      if (classes.includes('katex-error')) {
        const location = node.sourceCodeLocation
        if (
          node.namespaceURI !== htmlNamespace ||
          !['span', 'p'].includes(node.tagName) ||
          !location?.startTag ||
          !location.endTag ||
          node.childNodes.some(child => !('value' in child))
        ) {
          return undefined
        }

        // Retain layout and other attributes. Only title and error text vary freely.
        const attributes = node.attrs
          .filter(attribute => attribute.name !== 'title')
          .map(
            attribute =>
              [
                attribute.prefix
                  ? `${attribute.prefix}:${attribute.name}`
                  : attribute.name,
                attribute.value
              ] as const
          )
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

        edits.push({
          start: location.startTag.startOffset,
          end: location.endTag.endOffset,
          value:
            `<${node.tagName}` +
            attributes
              .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
              .join('') +
            `></${node.tagName}>`
        })

        continue
      }
    }

    if ('childNodes' in node) {
      for (const child of node.childNodes) pending.push(child)
    }
  }

  const value = applyHtmlEdits(source, edits)
  return value === undefined ? undefined : { value, errors: edits.length }
}
