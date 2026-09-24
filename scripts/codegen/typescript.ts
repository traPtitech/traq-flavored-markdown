import type { RawSchema, Shape } from './schema.ts'
import { quoted as q, shape } from './schema.ts'

function description(text?: string, indent = ''): string {
  if (!text) return ''
  return (
    `${indent}/**\n` +
    text
      .replaceAll('*/', '* /')
      .split('\n')
      .map(line => `${indent} * ${line}\n`)
      .join('') +
    `${indent} */\n`
  )
}

function expression(contract: Shape, reference = true): string {
  if (reference && contract.name) return contract.name
  if (contract.kind === 'string') return 'string'
  if (contract.kind === 'boolean') return 'boolean'
  if (contract.kind === 'integer') return 'number'
  if (contract.kind === 'literal') return q(contract.value)
  if (contract.kind === 'enum')
    return contract.values.map(value => q(value)).join(' | ')
  if (contract.kind === 'union')
    return contract.variants.map(variant => expression(variant)).join(' | ')
  if (contract.kind === 'nullable')
    return `${expression(contract.inner)} | null`
  if (contract.kind === 'array') return `Array<${expression(contract.items)}>`
  if (contract.kind === 'object') {
    if (!contract.fields.length) return 'Record<string, never>'
    return (
      '{\n' +
      contract.fields
        .map(
          field =>
            description(field.description, '  ') +
            `  ${q(field.name)}${field.required ? '' : '?'}: ${expression(field.shape)};`
        )
        .join('\n') +
      '\n}'
    )
  }
  throw new Error('Unsupported TypeScript contract')
}

function declaration(name: string, schema: RawSchema, root: RawSchema): string {
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(name))
    throw new Error('Invalid TypeScript contract name: ' + name)
  return (
    description(schema.description) +
    `export type ${name} = ${expression(shape(schema, root), false)};`
  )
}

/** Emit type aliases from the same normalized schema interpreted by validators. */
export function typescriptDeclarations(schemas: Iterable<RawSchema>) {
  const declarations = new Map<string, string>()
  function add(name: string, schema: RawSchema, root: RawSchema) {
    const source = declaration(name, schema, root)
    const previous = declarations.get(name)
    if (previous !== undefined && previous !== source)
      throw new Error('Conflicting TypeScript contract: ' + name)
    declarations.set(name, source)
  }
  for (const schema of schemas) {
    if (!schema.title) throw new Error('Schema missing title')
    add(schema.title, schema, schema)
    for (const [name, definition] of Object.entries(schema.$defs ?? {}))
      add(name, definition, schema)
  }
  return declarations
}
