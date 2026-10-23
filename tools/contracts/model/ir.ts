import { isDeepStrictEqual } from 'node:util'

import { type FieldShape, type RawSchema, type Shape, shape } from './schema.ts'

export type Direction = 'request' | 'response'
export type ContractField = Omit<FieldShape, 'shape'> & { shape: ContractShape }
export type ContractShape =
  | { kind: 'reference'; name: string }
  | Exclude<Shape, { kind: 'nullable' | 'array' | 'object' | 'union' }>
  | { kind: 'nullable'; inner: ContractShape }
  | {
      kind: 'array'
      items: ContractShape
      minItems?: number
      maxItems?: number
    }
  | { kind: 'object'; fields: ContractField[] }
  | { kind: 'union'; variants: ContractShape[]; discriminator?: string }

export type ContractDefinition = {
  name: string
  direction: Direction
  description?: string
  shape: ContractShape
}

export type ContractModule = {
  definitions: ReadonlyMap<string, ContractDefinition>
  roots: readonly string[]
}

function normalize(value: Shape, reference = true): ContractShape {
  if (reference && value.name) return { kind: 'reference', name: value.name }
  switch (value.kind) {
    case 'nullable':
      return { kind: 'nullable', inner: normalize(value.inner) }
    case 'array':
      return { ...value, items: normalize(value.items) }
    case 'object':
      return {
        kind: 'object',
        fields: value.fields.map(field => ({
          ...field,
          shape: normalize(field.shape)
        }))
      }
    case 'union': {
      const variants = value.variants.map(variant => normalize(variant))
      const tag = variants.every(
        variant =>
          variant.kind === 'object' &&
          variant.fields.some(
            field =>
              field.name === 'type' &&
              field.required &&
              field.shape.kind === 'literal'
          )
      )
      return {
        kind: 'union',
        variants,
        ...(tag ? { discriminator: 'type' } : {})
      }
    }
    default:
      return value
  }
}

/** Parse schema once into a language-neutral graph, preserving names and defaults. */
export function normalizeContracts(
  schemas: Iterable<RawSchema>,
  directions: Readonly<Record<string, Direction>> = {},
  schemaRoot?: RawSchema
): ContractModule {
  const definitions = new Map<string, ContractDefinition>()
  const roots: string[] = []
  function add(
    name: string,
    schema: RawSchema,
    root: RawSchema,
    direction: Direction
  ) {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name))
      throw new Error('Invalid contract name: ' + name)
    const definition: ContractDefinition = {
      name,
      direction,
      description: schema.description,
      shape: normalize(shape(schema, root), false)
    }
    const previous = definitions.get(name)
    if (
      previous &&
      (!isDeepStrictEqual(previous.shape, definition.shape) ||
        previous.description !== definition.description)
    ) {
      throw new Error('Conflicting contract: ' + name)
    }
    definitions.set(name, definition)
  }
  for (const schema of schemas) {
    if (!schema.title) throw new Error('Schema missing title')
    const direction = directions[schema.title] ?? 'response'
    const root = schemaRoot ?? schema
    add(schema.title, schema, root, direction)
    roots.push(schema.title)
    for (const [name, definition] of Object.entries(root.$defs ?? {}))
      add(name, definition, root, direction)
  }
  return { definitions, roots }
}
