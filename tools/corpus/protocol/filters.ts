import type { ClassificationId } from './classification.ts'

type FilterDefinition = {
  id: string
  bit: number
  classification: ClassificationId
  query: string
}

/** Bit positions are persisted; append definitions without changing existing meanings. */
export const filterDefinitions = [
  {
    id: 'whitespace',
    bit: 0,
    classification: 'text.whitespace',
    query: 'ignoreWhitespace'
  },
  { id: 'case', bit: 1, classification: 'text.case', query: 'ignoreCase' },
  {
    id: 'linkedImages',
    bit: 2,
    classification: 'image.linked',
    query: 'ignoreLinkedImages'
  },
  {
    id: 'htmlSerialization',
    bit: 3,
    classification: 'html.serialization',
    query: 'ignoreHtmlSerialization'
  },
  {
    id: 'katexErrors',
    bit: 4,
    classification: 'math.diagnostic',
    query: 'ignoreKatexErrors'
  },
  {
    id: 'linkPolicy',
    bit: 5,
    classification: 'link.policy',
    query: 'ignoreLinkPolicy'
  },
  {
    id: 'nestedLinks',
    bit: 6,
    classification: 'reference.nested',
    query: 'ignoreNestedLinks'
  }
] as const satisfies readonly FilterDefinition[]

export type FilterId = (typeof filterDefinitions)[number]['id']

export type FilterQuery = Record<
  (typeof filterDefinitions)[number]['query'],
  boolean
>

type CombinationName<Definitions extends readonly FilterDefinition[]> =
  Definitions extends readonly [
    ...infer Rest extends readonly FilterDefinition[],
    infer Last extends FilterDefinition
  ]
    ? | Last['id']
      | CombinationName<Rest>
      | `${CombinationName<Rest>}And${Capitalize<Last['id']>}`
    : never

const byId = new Map<FilterId, (typeof filterDefinitions)[number]>(
  filterDefinitions.map(definition => [definition.id, definition])
)

export const filterSelectionBit = (id: FilterId) => 1 << byId.get(id)!.bit

export const filterResultBit = (selection: number) =>
  selection ? 1n << BigInt(selection - 1) : 0n

export const filterCombinations = Array.from(
  { length: (1 << filterDefinitions.length) - 1 },
  (_, index) => index + 1
)

export const selectedFilters = (selection: number) =>
  filterDefinitions.filter(definition => selection & (1 << definition.bit))

export const differenceFilters = Object.fromEntries(
  filterCombinations.map(selection => {
    const name = selectedFilters(selection)
      .map(({ id }, index) =>
        index ? 'And' + id[0].toUpperCase() + id.slice(1) : id
      )
      .join('')

    return [name, filterResultBit(selection)]
  })
) as Record<CombinationName<typeof filterDefinitions>, bigint>

export function filterQueryMask(query: FilterQuery): bigint {
  const selection = filterDefinitions.reduce(
    (mask, definition) =>
      query[definition.query] ? mask | (1 << definition.bit) : mask,
    0
  )

  return filterResultBit(selection)
}

/** One result bit for each nonempty selection, rounded to whole hex digits. */
export const filterMaskWidth = Math.ceil(filterCombinations.length / 4)

const filterMaskLimit = 1n << BigInt(filterCombinations.length)

export const encodeFilterMasks = (masks: readonly bigint[]) =>
  masks.map(mask => mask.toString(16).padStart(filterMaskWidth, '0')).join('')

export const filterMaskAt = (encoded: string, index: number) =>
  BigInt(
    '0x' + encoded.slice(index * filterMaskWidth, (index + 1) * filterMaskWidth)
  )

export function validFilterMasks(encoded: string, count: number) {
  if (encoded.length !== count * filterMaskWidth) return false

  for (let index = 0; index < count; index++) {
    const mask = encoded.slice(
      index * filterMaskWidth,
      (index + 1) * filterMaskWidth
    )

    if (/[^0-9a-f]/.test(mask) || BigInt('0x' + mask) >= filterMaskLimit) {
      return false
    }
  }

  return true
}
