// Accept only the schema forms emitted for the supported payload types.
// Context-specific checks prevent silently discarding combined constraints.
export type RawSchema = {
  $schema?: string
  $defs?: Record<string, RawSchema>
  title?: string
  description?: string
  default?: unknown
  $ref?: string
  anyOf?: RawSchema[]
  oneOf?: RawSchema[]
  const?: unknown
  type?: string | string[]
  enum?: unknown[]
  format?: string | number
  minimum?: number | string
  maximum?: number | string
  items?: RawSchema
  properties?: Record<string, RawSchema | unknown>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: unknown
}

export type NullableShape = { kind: 'nullable'; inner: Shape; name?: string }
export type EnumShape = { kind: 'enum'; values: string[]; name?: string }
export type LiteralShape = { kind: 'literal'; value: string; name?: string }
export type UnionShape = { kind: 'union'; variants: Shape[]; name?: string }
export type StringShape = { kind: 'string'; name?: string }
export type BooleanShape = { kind: 'boolean'; name?: string }
export type IntegerShape = {
  kind: 'integer'
  format: string
  min: number
  max: number
  name?: string
}
export type ArrayShape = { kind: 'array'; items: Shape; name?: string }
export type FieldShape = { name: string; required: boolean; shape: Shape }
export type ObjectShape = {
  kind: 'object'
  fields: FieldShape[]
  name?: string
}

export type Shape =
  | NullableShape
  | EnumShape
  | LiteralShape
  | UnionShape
  | StringShape
  | BooleanShape
  | IntegerShape
  | ArrayShape
  | ObjectShape

const metadata = ['$schema', '$defs', 'title', 'description', 'default']
function keys(schema: RawSchema, allowed: string[]) {
  for (const key of Object.keys(schema))
    if (!metadata.includes(key) && !allowed.includes(key))
      throw new Error('Unsupported schema keyword: ' + key)
}
export function shape(
  schema: RawSchema,
  root: RawSchema = schema,
  references = new Set<string>()
): Shape {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema))
    throw new Error('Expected an object schema')
  if (schema.$ref) {
    keys(schema, ['$ref'])
    if (!schema.$ref.startsWith('#/$defs/'))
      throw new Error('Only local schema references are supported')
    if (references.has(schema.$ref))
      throw new Error('Recursive payload schemas are unsupported')
    const target = root.$defs?.[schema.$ref.slice(8)]
    if (!target) throw new Error('Unresolved schema reference: ' + schema.$ref)
    return {
      ...shape(target, root, new Set([...references, schema.$ref])),
      name: schema.$ref.slice(8)
    }
  }

  if (schema.oneOf) {
    keys(schema, ['oneOf'])
    if (schema.oneOf.length < 2)
      throw new Error('Unions must have at least two variants')
    return {
      kind: 'union',
      variants: schema.oneOf.map(variant => shape(variant, root, references))
    }
  }

  if (schema.anyOf || Array.isArray(schema.type)) {
    keys(schema, schema.anyOf ? ['anyOf'] : ['type'])
    const variants: RawSchema[] =
      schema.anyOf ??
      (Array.isArray(schema.type)
        ? schema.type.map((type: string) => ({ type }))
        : [])
    const real = variants.filter(s => s.type !== 'null')
    if (variants.length !== 2 || real.length !== 1)
      throw new Error('Only nullable unions are supported')
    const nullVariant = variants.find(s => s.type === 'null')
    if (nullVariant) keys(nullVariant, ['type'])
    return { kind: 'nullable', inner: shape(real[0], root, references) }
  }

  if (schema.const !== undefined) {
    keys(schema, ['type', 'const'])
    if (
      typeof schema.const !== 'string' ||
      (schema.type && schema.type !== 'string')
    )
      throw new Error('Only string constants are supported')
    return { kind: 'literal', value: schema.const }
  }

  if (schema.enum) {
    keys(schema, ['type', 'enum'])
    if (
      schema.type !== 'string' ||
      !schema.enum.length ||
      !schema.enum.every((s: unknown) => typeof s === 'string')
    )
      throw new Error('Only nonempty string enums are supported')
    return { kind: 'enum', values: schema.enum as string[] }
  }

  if (schema.type === 'string' || schema.type === 'boolean') {
    keys(schema, ['type'])
    return { kind: schema.type }
  }

  if (schema.type === 'integer') {
    keys(schema, ['type', 'format', 'minimum', 'maximum'])
    if (typeof schema.format !== 'string')
      throw new Error('Unsupported integer representation or constraints')
    const ranges: Record<string, [number, number]> = {
      uint8: [0, 255],
      uint32: [0, 0xffffffff]
    }
    const range = ranges[schema.format]
    if (
      !range ||
      schema.minimum !== range[0] ||
      (schema.maximum ?? range[1]) !== range[1]
    )
      throw new Error('Unsupported integer representation or constraints')
    return {
      kind: 'integer',
      format: schema.format,
      min: range[0],
      max: range[1]
    }
  }

  if (schema.type === 'array') {
    keys(schema, ['type', 'items'])
    if (!schema.items) throw new Error('Array schema missing items')
    return { kind: 'array', items: shape(schema.items, root, references) }
  }

  if (schema.type === 'object') {
    keys(schema, ['type', 'properties', 'required', 'additionalProperties'])
    if (schema.additionalProperties !== false)
      throw new Error('Payload objects must reject unknown fields')
    const required = schema.required ?? []
    const properties = (schema.properties ?? {}) as Record<string, RawSchema>
    if (!required.every((name: string) => Object.hasOwn(properties, name)))
      throw new Error('Required field lacks a property schema')
    return {
      kind: 'object',
      fields: Object.entries(properties).map(([name, s]) => ({
        name,
        required: required.includes(name),
        shape: shape(s as RawSchema, root, references)
      }))
    }
  }

  throw new Error('Unsupported schema type: ' + schema.type)
}

export function typeName(schema: RawSchema) {
  const name = schema.title?.replace(/Data$/, '')
  if (!name || !/^[A-Z][A-Za-z0-9_]*$/.test(name))
    throw new Error('Expected an exported payload type name')
  return name
}
export const quoted = JSON.stringify
