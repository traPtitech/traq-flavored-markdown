import { nodeGroup } from '../../../../scripts/codegen/groups.ts'

export function typescriptFiles(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const files = new Map<string, string>()
  const owners = [...new Set(Object.values(manifest.nodes).map(n => n.group))]
  for (const group of owners) nodeGroup(group)
  files.set(
    'typescript/generated/nodes.ts',
    '// Generated from Rust contracts. Do not edit.\n' +
      "import type { Node as AstNode, Document as AstDocument, DeepReadonly } from '@traq-flavored-markdown/core';\n" +
      owners
        .map(
          g =>
            `import * as ${g} from '@traq-flavored-markdown/${nodeGroup(g).typescriptNodes}';`
        )
        .join('\n') +
      '\n' +
      `export type NodeKind = ${owners.map(g => `${g}.NodeKind`).join(' | ')};\n` +
      'export type Node<AllowUnknown extends boolean = false> =\n' +
      ' AstNode<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;\n' +
      'export type Document<AllowUnknown extends boolean = false> = AstDocument<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;\n' +
      `export const names = Object.freeze({${owners.map(g => `...${g}.names`).join(',')}});\n` +
      `export const definitions = Object.freeze({${owners.map(g => `...${g}.definitions`).join(',')}});\n` +
      'const validators = new Map<string,(data:unknown)=>boolean>(Object.values(definitions).map(definition => [definition.kind, definition.validateData]));\n' +
      'export const nodes: ReadonlyMap<string,(data:unknown)=>boolean> = new Map(validators);\n' +
      'export function isKnownNode<T extends {kind: string; data:unknown}>(node:T):node is T & DeepReadonly<NodeKind> {return validators.get(node.kind)?.(node.data) ?? false;}\n'
  )
  return files
}
