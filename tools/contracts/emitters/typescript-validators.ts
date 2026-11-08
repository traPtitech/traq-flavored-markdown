import {
  type ContractModule,
  type ContractShape,
  normalizeContracts
} from '../model/ir.ts'
import type { RawSchema } from '../model/schema.ts'
import { quoted as q, typeName } from '../model/schema.ts'
import type { NodeStructure } from '../model/structure.ts'
import { block, lines, sections, sourceFile } from './source.ts'

function validator(s: ContractShape): string {
  if (s.kind === 'reference') return `validate${s.name}`

  if (s.kind === 'string') {
    if (s.minLength === undefined && s.maxLength === undefined) return 'string'

    const bounds = [
      ...(s.minLength !== undefined ? [`length >= ${s.minLength}`] : []),
      ...(s.maxLength !== undefined ? [`length <= ${s.maxLength}`] : [])
    ]

    return block(
      '(value: unknown) => {',
      sections(
        'if (!string(value)) return false;',
        'let length = 0;',
        block(
          'for (const scalar of value) {',
          sections(
            lines(
              'const point = scalar.codePointAt(0)!;',
              'if (point >= 0xd800 && point <= 0xdfff) return false;'
            ),
            'length++;'
          )
        ),
        `return ${bounds.join(' && ')};`
      )
    )
  }

  if (s.kind === 'boolean') return s.kind

  if (s.kind === 'integer') {
    return `(value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= ${s.min} && value <= ${s.max}`
  }

  if (s.kind === 'number') {
    return `(value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= ${s.min} && value <= ${s.max}`
  }

  if (s.kind === 'enum') {
    return 'oneOf(' + s.values.map(v => q(v)).join(',') + ')'
  }

  if (s.kind === 'literal') return 'oneOf(' + q(s.value) + ')'

  if (s.kind === 'union') {
    return (
      '(value: unknown) => [' +
      s.variants.map(validator).join(',') +
      '].filter(check => check(value)).length === 1'
    )
  }

  if (s.kind === 'nullable') return 'nullable(' + validator(s.inner) + ')'

  if (s.kind === 'array') {
    return (
      '(value: unknown) => Array.isArray(value) && value.every(' +
      validator(s.items) +
      ')' +
      (s.minItems !== undefined ? ` && value.length >= ${s.minItems}` : '') +
      (s.maxItems !== undefined ? ` && value.length <= ${s.maxItems}` : '')
    )
  }

  if (s.kind === 'object') {
    const fields = (required: boolean) =>
      '{' +
      s.fields
        .filter(f => f.required === required)
        .map(f => q(f.name) + ':' + validator(f.shape))
        .join(',') +
      '}'

    return (
      '(value: unknown) => fields(value,' +
      fields(true) +
      ',' +
      fields(false) +
      ')'
    )
  }

  throw new Error('Unsupported validator')
}

export function emitContractValidators(
  module: ContractModule,
  fieldsImport: string
) {
  return sections(
    `import {fields,string,boolean,nullable,oneOf} from ${q(fieldsImport)}`,
    [...module.definitions.values()].map(definition =>
      block(
        `function validate${definition.name}(value: unknown): boolean {`,
        `return (${validator(definition.shape)})(value)`
      )
    )
  )
}

export function emitTypeScriptValidators(
  entries: [string, RawSchema][],
  fieldsImport = '../fields.js',
  definitionImport = '@traq-flavored-markdown/core',
  structures: Readonly<Record<string, NodeStructure | undefined>> = {}
) {
  const used = new Set()
  const module = normalizeContracts(entries.map(([, schema]) => schema))

  for (const [, schema] of entries) {
    const name = typeName(schema).toLowerCase()
    if (used.has(name)) {
      throw new Error('Duplicate generated payload type: ' + name)
    }

    used.add(name)
  }

  const names = Object.fromEntries(
    entries.map(([name, schema]) => [typeName(schema), name])
  )

  return sourceFile(
    lines(
      '// Generated from Rust node payload types. Do not edit.',
      `import { defineNode, DocumentSchema, type DeepReadonly } from ${q(definitionImport)}`,
      emitContractValidators(module, fieldsImport)
    ),
    `export const names = Object.freeze(${q(names)} as const)`,
    block(
      'const validators = new Map<string, (data: unknown) => boolean>([',
      lines(
        entries.map(([name, schema]) => `[${q(name)},validate${schema.title}],`)
      ),
      '])'
    ),
    block(
      'export const definitions = Object.freeze({',
      lines(
        entries.map(([key, schema]) => {
          const name = typeName(schema)
          return `${name}: defineNode<Extract<NodeVariant, { kind: typeof names.${name} }>>(names.${name}, validators.get(names.${name})!${structures[key] ? ', ' + q(structures[key]) : ''}),`
        })
      ),
      '})'
    ),
    'export const schema = new DocumentSchema<NodeVariant>(Object.values(definitions))',
    lines(
      '// Check this payload only; children can still contain unknown nodes.',
      block(
        'export function isKnownNode<T extends {kind: string; data: unknown}>(node: T): node is T & DeepReadonly<NodeVariant> {',
        'return schema.isKnownNode(node)'
      )
    )
  )
}
