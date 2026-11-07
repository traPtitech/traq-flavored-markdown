import {
  type ContractDefinition,
  type ContractModule,
  type ContractShape
} from '../model/ir.ts'
import { quoted as q } from '../model/schema.ts'
import { block, lines } from './source.ts'

function description(text?: string): string {
  if (!text) return ''

  return block(
    '/**',
    lines(
      text
        .replaceAll('*/', '* /')
        .split('\n')
        .map(line => ` * ${line}`)
    ),
    ' */'
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
        ? block(
            '{',
            lines(
              contract.fields.map(field =>
                lines(
                  description(field.description),
                  `${q(field.name)}${field.required ? '' : '?'}: ${expression(field.shape)};`
                )
              )
            )
          )
        : 'Record<string, never>'
  }
}

export function emitTypeScriptDefinition(definition: ContractDefinition) {
  return lines(
    description(definition.description),
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
