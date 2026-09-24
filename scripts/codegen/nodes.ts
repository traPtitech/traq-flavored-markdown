import { javascript } from './javascript.ts'
import type { RawSchema } from './schema.ts'
import { quoted as q } from './schema.ts'
import { typescriptDeclarations } from './typescript.ts'

type Manifest = {
  nodes: Record<string, { group: string; schema: RawSchema }>
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
        javascript(entries, '@traq-flavored-markdown/core/validation')
    )
  }
  return files
}
