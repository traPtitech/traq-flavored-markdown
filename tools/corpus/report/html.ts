import { decodeHTML, escapeAttribute, escapeText } from 'entities'
import { type DefaultTreeAdapterTypes, parseFragment } from 'parse5'

type Edit = { start: number; end: number; value: string }
const htmlNamespace = 'http://www.w3.org/1999/xhtml'
const voidElements = new Set(
  'area base br col embed hr img input link meta param source track wbr'.split(
    ' '
  )
)

/** Normalize spelling, not structure: only rewrite parsed start tags and text. */
export function normalizeHtmlSerialization(source: string): string | undefined {
  if (!/[<&]/.test(source)) return source
  let invalid = false
  const fragment = parseFragment(source, {
    sourceCodeLocationInfo: true,
    onParseError: () => {
      invalid = true
    }
  })
  if (invalid) return undefined
  const edits: Edit[] = []
  const pending: DefaultTreeAdapterTypes.Node[] = [...fragment.childNodes]
  while (pending.length) {
    const node = pending.pop()!
    const location = node.sourceCodeLocation
    if ('tagName' in node) {
      // Do not hide tree repairs such as an implicitly inserted tbody.
      const start =
        location && 'startTag' in location ? location.startTag : undefined
      if (!start) return undefined
      const selfClosing =
        node.namespaceURI !== htmlNamespace &&
        /\/\s*>$/.test(source.slice(start.startOffset, start.endOffset))
      if (
        !(location && 'endTag' in location && location.endTag) &&
        !(
          node.namespaceURI === htmlNamespace && voidElements.has(node.tagName)
        ) &&
        !selfClosing
      )
        return undefined
      const attributes = node.attrs
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
        start: start.startOffset,
        end: start.endOffset,
        value:
          '<' +
          node.tagName +
          attributes
            .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
            .join('') +
          (selfClosing ? '/>' : '>')
      })
      if ('content' in node) pending.push(node.content)
    } else if ('value' in node) {
      if (!location) return undefined
      const parent = node.parentNode
      // The HTML parser strips a first LF in these elements. Restore the
      // decoded source so this spelling filter never removes text whitespace.
      const preserveInitialNewline =
        parent &&
        'tagName' in parent &&
        parent.namespaceURI === htmlNamespace &&
        ['pre', 'listing', 'textarea'].includes(parent.tagName)
      edits.push({
        start: location.startOffset,
        end: location.endOffset,
        value: escapeText(
          preserveInitialNewline
            ? decodeHTML(source.slice(location.startOffset, location.endOffset))
            : node.value
        )
      })
    }
    if ('childNodes' in node)
      for (const child of node.childNodes) pending.push(child)
  }
  edits.sort((a, b) => a.start - b.start)
  const result: string[] = []
  let end = 0
  for (const edit of edits) {
    // Foster parenting or merged, non-contiguous text must not erase tags.
    if (edit.start < end) return undefined
    result.push(source.slice(end, edit.start), edit.value)
    end = edit.end
  }
  result.push(source.slice(end))
  return result.join('')
}
