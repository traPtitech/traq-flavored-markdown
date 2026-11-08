import { isLiteralSource } from '@traq-flavored-markdown/sdk/editor'

import { partsToProjectedText } from '../../src/projection.js'
import type { InputPart, ReferenceCodec } from '../../src/types.js'
import { analyzeMarkdownSource } from './markdown.js'
import { type TestReference, parseInput, serializeInput } from './references.js'

export const normalize = (
  parts: readonly InputPart<TestReference>[],
  analysis?: ReturnType<typeof analyzeMarkdownSource>
): InputPart<TestReference>[] => {
  if (!parts.some(part => part.type === 'reference')) return [...parts]

  const source = partsToProjectedText(parts)

  const literals = (
    analysis?.source === source ? analysis : analyzeMarkdownSource(source)
  ).nodes.filter(isLiteralSource)

  let offset = 0

  return parts.map(part => {
    const literal = literals.some(
      node => node.from <= offset && offset < node.to
    )

    offset += part.type === 'text' ? part.text.length : 1

    return literal && part.type === 'reference'
      ? { type: 'text', text: part.reference.label }
      : part
  })
}

export const normalizeSource = (source: string) =>
  serializeInput(normalize(parseInput(source)))

export const markdownReferenceCodec: ReferenceCodec<TestReference> = {
  parse: source => normalize(parseInput(source)),
  serialize: serializeInput,
  normalize: (parts, analysis) =>
    normalize(parts, analysis).flatMap((part, index) =>
      parts[index].type === 'reference' && part.type === 'text'
        ? [{ index, text: part.text }]
        : []
    )
}
