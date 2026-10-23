/** A small, portable protocol description consumed by TypeScript and the Go worker. */
export type Schema =
  | { kind: 'string'; minLength?: number; pattern?: string }
  | { kind: 'number'; integer?: boolean; minimum?: number }
  | { kind: 'boolean' }
  | { kind: 'enum'; name: string; values: readonly string[] }
  | {
      kind: 'object'
      name: string
      properties: Record<string, Schema>
      allowUnknown?: boolean
    }
  | { kind: 'array'; items: Schema }
  | { kind: 'record'; values: Schema; keys?: readonly string[] }

export type Infer<S extends Schema> = S extends { kind: 'string' }
  ? string
  : S extends { kind: 'number' }
    ? number
    : S extends { kind: 'boolean' }
      ? boolean
      : S extends { kind: 'enum'; values: readonly (infer V)[] }
        ? V
        : S extends { kind: 'array'; items: infer I extends Schema }
          ? Infer<I>[]
          : S extends {
                kind: 'record'
                values: infer V extends Schema
                keys: readonly (infer K extends string)[]
              }
            ? Record<K, Infer<V>>
            : S extends { kind: 'record'; values: infer V extends Schema }
              ? Record<string, Infer<V>>
              : S extends {
                    kind: 'object'
                    properties: infer P extends Record<string, Schema>
                  }
                ? { [K in keyof P]: Infer<P[K]> }
                : never

export const string = { kind: 'string' } as const
export const nonempty = { kind: 'string', minLength: 1 } as const
export const digest = { kind: 'string', pattern: '^[0-9a-f]{64}$' } as const
export const count = { kind: 'number', integer: true, minimum: 0 } as const
export const positiveCount = {
  kind: 'number',
  integer: true,
  minimum: 1
} as const
export const duration = { kind: 'number', minimum: 0 } as const
export const boolean = { kind: 'boolean' } as const
export const enumeration = <const V extends readonly string[]>(
  name: string,
  values: V
) => ({ kind: 'enum', name, values }) as const
export const object = <const P extends Record<string, Schema>>(
  name: string,
  properties: P,
  allowUnknown = false
) => ({ kind: 'object', name, properties, allowUnknown }) as const
export const array = <S extends Schema>(items: S) =>
  ({ kind: 'array', items }) as const
export const record = <S extends Schema>(values: S) =>
  ({ kind: 'record', values }) as const
export const keyedRecord = <
  S extends Schema,
  const K extends readonly string[]
>(
  values: S,
  keys: K
) => ({ kind: 'record', values, keys }) as const

export function validate(
  schema: Schema,
  value: unknown,
  location = schema.kind === 'object' ? schema.name : 'value'
): void {
  const fail = (): never => {
    throw new Error(`Invalid ${location}`)
  }
  switch (schema.kind) {
    case 'string':
      if (
        typeof value !== 'string' ||
        (schema.minLength !== undefined && value.length < schema.minLength) ||
        (schema.pattern && !new RegExp(schema.pattern).test(value))
      )
        fail()
      break
    case 'number':
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (schema.integer && !Number.isSafeInteger(value)) ||
        (schema.minimum !== undefined && value < schema.minimum)
      )
        fail()
      break
    case 'boolean':
      if (typeof value !== 'boolean') fail()
      break
    case 'enum':
      if (typeof value !== 'string' || !schema.values.includes(value)) fail()
      break
    case 'array':
      if (!Array.isArray(value)) fail()
      ;(value as unknown[]).forEach((item, index) =>
        validate(schema.items, item, `${location}[${index}]`)
      )
      break
    case 'record':
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
      const fields = value as Record<string, unknown>
      if (schema.kind === 'object') {
        for (const [key, field] of Object.entries(schema.properties))
          validate(field, fields[key], `${location}.${key}`)
        if (
          !schema.allowUnknown &&
          Object.keys(fields).some(
            key => !Object.hasOwn(schema.properties, key)
          )
        )
          fail()
      } else {
        if (
          schema.keys &&
          (Object.keys(fields).length !== schema.keys.length ||
            !schema.keys.every(key => Object.hasOwn(fields, key)))
        )
          fail()
        for (const [key, field] of Object.entries(fields))
          validate(schema.values, field, `${location}.${key}`)
      }
    }
  }
}

export function parse<S extends Schema>(schema: S, value: unknown): Infer<S> {
  validate(schema, value)
  return value as Infer<S>
}
