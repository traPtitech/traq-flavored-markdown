export type TraqLink = { type: 'file' | 'message'; id: string }
export type Embedding = TraqLink | { type: 'url'; url: string }

export function normalizeTraqOrigin(origin: string) {
  return origin.replace(/\/+$/, '')
}

function pathAtOrigin(value: string, origin: string) {
  const base = normalizeTraqOrigin(origin)
  if (!base || !value.startsWith(base)) return

  const rest = value.slice(base.length)
  if (rest && !['/', '?', '#'].includes(rest[0])) return
  return rest
}

function resourceAtPath(rest: string): TraqLink | undefined {
  const path = rest.split(/[?#]/, 1)[0]
  const match =
    /^\/(files|messages)\/([\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12})$/.exec(
      path
    )
  if (!match || match[0] !== path) return
  return {
    type: match[1] === 'files' ? 'file' : 'message',
    id: match[2].toLowerCase()
  }
}

/** Shared lexical policy with Rust processing/links.rs; no URL normalization.
 * Only the configured origin and an exact UUID path identify a traQ resource.
 */
export function classifyTraqLink(
  value: string,
  origin: string
): TraqLink | undefined {
  const rest = pathAtOrigin(value, origin)
  return rest === undefined ? undefined : resourceAtPath(rest)
}

/** Classify cards using the same lexical origin policy as traQ links. */
export function embeddingFromUrl(
  value: string,
  origin: string
): Embedding | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const rest = pathAtOrigin(value, origin)
  return rest === undefined ? { type: 'url', url: value } : resourceAtPath(rest)
}
