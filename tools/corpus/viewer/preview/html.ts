const allowed = new Set(
  'p div span pre code br hr strong b em i del s ins mark sub sup a ul ol li blockquote h1 h2 h3 h4 h5 h6 table thead tbody tr td th cite svg path line'.split(
    ' '
  )
)
const styleNames = [
  'height',
  'width',
  'min-width',
  'vertical-align',
  'margin-right',
  'margin-left',
  'top',
  'background-color',
  'text-align'
]

/** Build an inert approximation: no navigation, fetches, handlers, or UI classes. */
export function createInertPreviewFragment(
  html: string,
  document: Document = globalThis.document
) {
  const template = document.createElement('template')
  template.innerHTML = html

  const copy = (node: Node): Node => {
    if (node.nodeType === Node.TEXT_NODE)
      return document.createTextNode(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('')
    const element = node as Element

    if (element.localName === 'img') {
      const span = document.createElement('span')
      span.className = 'r-image'
      span.textContent =
        '[画像: ' + (element.getAttribute('alt') || '外部画像') + ']'
      return span
    }

    if (!allowed.has(element.localName)) return document.createTextNode('')

    const name = element.localName === 'a' ? 'span' : element.localName
    const value = ['svg', 'path', 'line'].includes(name)
      ? document.createElementNS('http://www.w3.org/2000/svg', name)
      : document.createElement(name)

    for (const attr of [
      'title',
      'colspan',
      'rowspan',
      'start',
      'aria-hidden',
      'viewBox',
      'd',
      'width',
      'height',
      'x1',
      'x2',
      'y1',
      'y2'
    ]) {
      if (element.hasAttribute(attr)) {
        value.setAttribute(attr, element.getAttribute(attr)!)
      }
    }
    for (const name of element.classList) value.classList.add(`preview-${name}`)

    for (const key of styleNames) {
      const text = (element as HTMLElement).style?.getPropertyValue(key)
      if (text && !/url|var\(|attr\(/i.test(text)) {
        ;(value as HTMLElement).style?.setProperty(key, text)
      }
    }

    if (element.localName === 'a') {
      ;(value as HTMLElement).classList.add('r-link')
      ;(value as HTMLElement).title = element.getAttribute('href') || 'リンク'
    }

    for (const child of Array.from(element.childNodes)) {
      value.appendChild(copy(child))
    }
    return value
  }

  const result = document.createDocumentFragment()
  for (const child of Array.from(template.content.childNodes)) {
    result.appendChild(copy(child))
  }
  return result
}
