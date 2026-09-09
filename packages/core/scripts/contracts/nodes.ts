import path from 'path'

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
    const types = new Map()
    async function payload(name) {
      if (types.has(name)) return
      const source = await Bun.file(path.join(input, name + '.ts')).text()
      types.set(
        name,
        source
          .replace(/^\/\/[^\n]*\n/gm, '')
          .replace(/^import type .*;\r?\n/gm, '')
          .replace(/[ \t]+$/gm, '')
          .trim()
      )
      for (const match of source.matchAll(/from ["']\.\/([^"']+)\.js["']/g))
        await payload(match[1])
    }

    for (const [, schema] of entries) await payload(schema.title)

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
