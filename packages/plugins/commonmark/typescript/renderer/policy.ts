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
