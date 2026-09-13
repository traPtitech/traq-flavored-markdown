export type TraqLink = { type: 'file' | 'message'; id: string }

/** Shared lexical policy with Rust processing/links.rs; no URL normalization.
 * Only the configured origin and an exact UUID path identify a traQ resource.
 */
export function classifyTraqLink(
  value: string,
  origin: string
): TraqLink | undefined {
  const base = origin.replace(/\/+$/, '')
  if (!base || !value.startsWith(base)) return
  const path = value.slice(base.length).split(/[?#]/, 1)[0]
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
