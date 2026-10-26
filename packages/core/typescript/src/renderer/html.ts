const escapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, c => escapes[c])

export function attributes(values: Iterable<readonly [string, string]>) {
  return Array.from(values, ([name, value]) => {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(name))
      throw new TypeError('Invalid HTML attribute name: ' + name)

    return ' ' + name + '="' + escapeHtml(value) + '"'
  }).join('')
}

// Conservative defaults for standalone rendering. Applications can supply
// their own policies without changing how the shared parser recognizes links.
const linkProtocols = new Set([
  'http:',
  'https:',
  'mailto:',
  'ftp:',
  'tel:',
  'sms:',
  'geo:'
])
const imageProtocols = new Set(['http:', 'https:'])

function protocol(destination: string) {
  try {
    return new URL(destination, 'https://markdown.invalid').protocol
  } catch {
    return undefined
  }
}

export function validateLink(destination: string) {
  return linkProtocols.has(protocol(destination) ?? '')
}

export function validateImage(destination: string) {
  return imageProtocols.has(protocol(destination) ?? '')
}
