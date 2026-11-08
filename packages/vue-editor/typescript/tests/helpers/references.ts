import type { InputPart, ReferenceCodec } from '../../src/types.js'

// A test-host format deliberately independent of traQ's reference JSON.
export type TestReference = Readonly<{ key: string; label: string }>

export const encodeReference = (reference: TestReference) =>
  `[[item:${encodeURIComponent(JSON.stringify(reference))}]]`

export const parseInput = (source: string): InputPart<TestReference>[] => {
  const parts: InputPart<TestReference>[] = []
  let from = 0

  for (const match of source.matchAll(/\[\[item:([^\]]+)\]\]/g)) {
    const reference: unknown = JSON.parse(decodeURIComponent(match[1]))
    if (
      !reference ||
      typeof reference !== 'object' ||
      !('key' in reference) ||
      typeof reference.key !== 'string' ||
      !('label' in reference) ||
      typeof reference.label !== 'string'
    ) {
      continue
    }

    if (from < match.index) {
      parts.push({ type: 'text', text: source.slice(from, match.index) })
    }

    parts.push({
      type: 'reference',
      reference: { key: reference.key, label: reference.label },
      originalSource: match[0]
    })

    from = match.index + match[0].length
  }

  if (from < source.length) {
    parts.push({ type: 'text', text: source.slice(from) })
  }

  return parts
}

export const serializeInput = (parts: readonly InputPart<TestReference>[]) =>
  parts
    .map(part =>
      part.type === 'text'
        ? part.text
        : (part.originalSource ?? encodeReference(part.reference))
    )
    .join('')

export const partsToDisplayText = (
  parts: readonly InputPart<TestReference>[],
  label = (reference: TestReference) => reference.label
) =>
  parts
    .map(part => (part.type === 'text' ? part.text : label(part.reference)))
    .join('')

export const referenceCodec: ReferenceCodec<TestReference> = {
  parse: parseInput,
  serialize: serializeInput
}
