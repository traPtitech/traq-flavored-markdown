import { declarations } from './declarations.ts'
import { javascript } from './javascript.ts'
import { quoted as q } from './schema.ts'

type Manifest = {
  nodes: Record<string, { group: string; schema: { title: string } }>
}

export async function nodeFiles(manifest: Manifest, input: string) {
  const entries: [string, { title: string }][] = Object.entries(
    manifest.nodes
  ).map(([key, node]) => [key, node.schema])
  const groups = Map.groupBy(entries, ([key]) => manifest.nodes[key].group)
  const files = new Map()
  for (const [group, entries] of groups) {
    const types = await declarations(
      input,
      entries.map(([, schema]) => schema.title)
    )

    files.set(
      `${group}.ts`,
      '// Generated from Rust contracts. Do not edit.\n' +
        [...types.values()].join('\n') +
        '\nexport type NodeKind =\n' +
        entries
          .map(([key, s]) => ` | { kind: ${q(key)}; data: ${s.title} }`)
          .join('\n') +
        ';\n' +
        javascript(entries, '@traq-markdown-parser/core/validation')
    )
  }
  return files
}
