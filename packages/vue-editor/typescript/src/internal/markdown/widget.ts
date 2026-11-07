import type { MarkdownFormat } from './formats.js'
import type { MarkdownServices } from './services.js'

export const renderMarkdownWidget = (
  format: Extract<MarkdownFormat, { kind: 'rendered-inline' }>,
  render: MarkdownServices['render']
) => {
  const { replacement } = format
  const span = document.createElement('span')
  span.className = `markdown-input-${format.classSuffix} markdown-body`

  try {
    span.innerHTML = render(replacement.document, replacement.node)
  } catch {
    span.textContent = replacement.text
  }

  return span
}
