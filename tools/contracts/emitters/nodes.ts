import { normalizeContracts } from '../model/ir.ts'
import type { RawSchema } from '../model/schema.ts'
import { quoted as q } from '../model/schema.ts'
import type { NodeStructure } from '../model/structure.ts'
import { emitTypeScriptValidators } from './typescript-validators.ts'
import { typescriptDeclarations } from './typescript.ts'

type Manifest = {
  nodes: Record<
    string,
    { group: string; schema: RawSchema; structure?: NodeStructure }
  >
}

export function nodeFiles(manifest: Manifest) {
  const entries: [string, RawSchema][] = Object.entries(manifest.nodes).map(
    ([key, node]) => [key, node.schema]
  )

  const groups = Map.groupBy(entries, ([key]) => manifest.nodes[key].group)
  const files = new Map<string, string>()

  for (const [group, entries] of groups) {
    if (!group || !entries) continue

    const types = typescriptDeclarations(entries.map(([, schema]) => schema))
    const contracts = normalizeContracts(entries.map(([, schema]) => schema))
    const values: string[] = []
    const arrayLimits: string[] = []

    for (const [name, contract] of contracts.definitions) {
      if (contract.shape.kind === 'enum') {
        values.push(
          `${q(name)}: Object.freeze([${contract.shape.values.map(value => q(value)).join(', ')}] as const)`
        )
      }

      if (contract.shape.kind === 'object') {
        const fields = contract.shape.fields.flatMap(field => {
          const shape = field.shape
          if (
            shape.kind !== 'array' ||
            (shape.minItems === undefined && shape.maxItems === undefined)
          ) {
            return []
          }

          return [
            `${q(field.name)}: Object.freeze(${JSON.stringify({ minItems: shape.minItems, maxItems: shape.maxItems })})`
          ]
        })

        if (fields.length) {
          arrayLimits.push(`${q(name)}: Object.freeze({${fields.join(', ')}})`)
        }
      }
    }

    files.set(
      `${group}.ts`,
      '// Generated from Rust contracts. Do not edit.\n' +
        [...types.values()].join('\n\n') +
        `\n\nexport const contractValues = Object.freeze({${values.join(', ')}});\n\n` +
        `export const arrayLimits = Object.freeze({${arrayLimits.join(', ')}});\n` +
        '\nexport type NodeVariant =\n' +
        entries
          .map(([key, s]) => ` | { kind: ${q(key)}; data: ${s.title} }`)
          .join('\n') +
        ';\n\n' +
        emitTypeScriptValidators(
          entries,
          '@traq-flavored-markdown/core/validation',
          '@traq-flavored-markdown/core',
          Object.fromEntries(
            Object.entries(manifest.nodes).map(([key, node]) => [
              key,
              node.structure
            ])
          )
        )
    )
  }

  return files
}
