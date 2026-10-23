import { SourceText } from '@traq-flavored-markdown/core'
import type { SourceEdit } from '@traq-flavored-markdown/core'
import { utf8ByteLength } from '@traq-flavored-markdown/core/validation'

import type {
  LookupKind,
  ReferenceEmbeddingPlan,
  References
} from '../../generated/processing.js'

/** Resolves Rust's ordered AST-derived candidates and preserves all other source bytes. */
export function embedReferences(
  source: string,
  plan: ReferenceEmbeddingPlan,
  resolve: (kind: LookupKind, name: string) => string | undefined
): string {
  const text = new SourceText(source)
  let position = 0
  const edits: SourceEdit[] = []

  // Validate the complete plan before calling application resolvers.
  if (!plan || !Array.isArray(plan.candidates))
    throw new TypeError('Invalid reference embedding plan')
  const candidates = plan.candidates.map(({ start, end, raw, name, kind }) => {
    try {
      if (end <= start || text.slice({ start, end }) !== raw)
        throw new TypeError('Invalid candidate')
      if (kind !== 'user' && kind !== 'group' && kind !== 'channel')
        throw new TypeError('Invalid lookup kind')
      utf8ByteLength(name)
    } catch {
      throw new TypeError('Embedding plan does not match source')
    }
    return { start, end, raw, name, kind }
  })

  for (const candidate of candidates) {
    const { start, end, raw, kind, name } = candidate

    if (start < position) {
      continue
    }

    const id = resolve(kind, name)
    if (!id) {
      continue
    }

    utf8ByteLength(id)
    edits.push({
      span: { start, end },
      text: '!' + JSON.stringify({ type: kind, raw, id })
    })
    position = end
  }

  return text.replace(edits)
}

/** Uses parsed references, including those inside spoilers but excluding code/math. */
export function mentionsUser(
  references: References,
  userId: string,
  groupIds: readonly string[]
): boolean {
  return (
    references.mentions.includes(userId) ||
    references.groupMentions.some(id => groupIds.includes(id))
  )
}
