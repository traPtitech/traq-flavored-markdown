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

    files.set(
      `${group}.ts`,
      '// Generated from Rust contracts. Do not edit.\n' +
        [...types.values()].join('\n') +
        '\nexport type NodeKind =\n' +
        entries
          .map(([key, s]) => ` | { kind: ${q(key)}; data: ${s.title} }`)
          .join('\n') +
        ';\n' +
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
