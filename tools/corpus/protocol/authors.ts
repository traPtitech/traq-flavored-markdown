import {
  type Infer,
  digest,
  enumeration,
  nonempty,
  object,
  parse,
  string
} from './schema.ts'

/** Only the account category is retained; user identifiers never enter a run. */
export type AuthorKind = 'b' | 'h' | 'u'
export const validAuthorKinds = (value: string) => /^[bhu]*$/.test(value)
export function sourceAuthorKind(value: Record<string, unknown>): AuthorKind {
  if (value.isBot === undefined) return 'u'
  if (typeof value.isBot !== 'boolean') throw new Error('Invalid source isBot')
  return value.isBot ? 'b' : 'h'
}

const authorIndexSchema = object('AuthorIndex', {
  format: enumeration('AuthorIndexFormat', ['1']),
  runId: nonempty,
  corpusSha256: digest,
  kinds: string
})
export type AuthorIndex = Infer<typeof authorIndexSchema>
export function parseAuthorIndex(value: unknown): AuthorIndex {
  const index = parse(authorIndexSchema, value)
  if (!validAuthorKinds(index.kinds)) throw new Error('Invalid author kinds')
  return index
}
