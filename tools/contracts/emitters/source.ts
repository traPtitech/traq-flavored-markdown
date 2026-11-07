export type Source = string | false | null | undefined | readonly Source[]

function fragments(parts: readonly Source[]): string[] {
  return parts.flatMap(part => {
    if (Array.isArray(part)) return fragments(part)
    if (typeof part !== 'string') return []

    // Boundary cleanup keeps nested fragments composable while preserving literals.
    const content = part.replace(/^(?:[\t ]*\r?\n)+|(?:\r?\n[\t ]*)+$/g, '')

    return content.trim() ? [content] : []
  })
}

export function lines(...parts: readonly Source[]): string {
  return fragments(parts).join('\n')
}

export function sections(...parts: readonly Source[]): string {
  return fragments(parts).join('\n\n')
}

/** Explicit delimiters keep language syntax in the owning emitter. */
export function block(opening: string, body: Source, closing = '}'): string {
  return lines(opening, body, closing)
}

export function sourceFile(...parts: readonly Source[]): string {
  const content = sections(...parts)
  return content ? content + '\n' : ''
}
