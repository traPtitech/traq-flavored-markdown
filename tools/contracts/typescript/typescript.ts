import {
  type ContractDefinition,
  type ContractModule,
  type ContractShape,
  normalizeContracts
} from './ir.ts'
import { type RawSchema, quoted as q } from './schema.ts'

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

function expression(contract: ContractShape): string {
  switch (contract.kind) {
    case 'reference':
      return contract.name
    case 'string':
    case 'boolean':
      return contract.kind
    case 'integer':
    case 'number':
      return 'number'
    case 'literal':
      return q(contract.value)
    case 'enum':
      return contract.values.map(value => q(value)).join(' | ')
    case 'union':
      return contract.variants.map(expression).join(' | ')
    case 'nullable':
      return `${expression(contract.inner)} | null`
    case 'array':
      return `Array<${expression(contract.items)}>`
    case 'object':
      return contract.fields.length
        ? '{\n' +
            contract.fields
              .map(
                field =>
                  description(field.description, '  ') +
                  `  ${q(field.name)}${field.required ? '' : '?'}: ${expression(field.shape)};`
              )
              .join('\n') +
            '\n}'
        : 'Record<string, never>'
  }
}

export function emitTypeScriptDefinition(definition: ContractDefinition) {
  return (
    description(definition.description) +
    `export type ${definition.name} = ${expression(definition.shape)};`
  )
}

export function emitTypeScriptDeclarations(module: ContractModule) {
  return new Map(
    [...module.definitions].map(([name, definition]) => [
      name,
      emitTypeScriptDefinition(definition)
    ])
  )
}

export function typescriptDeclarations(schemas: Iterable<RawSchema>) {
  return emitTypeScriptDeclarations(normalizeContracts(schemas))
}
