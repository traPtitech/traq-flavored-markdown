import { nodeGroup } from '../../../../tools/contracts/model/groups.ts'

export function typescriptFiles(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const files = new Map<string, string>()
  const owners = [...new Set(Object.values(manifest.nodes).map(n => n.group))]
  for (const group of owners) nodeGroup(group)
  files.set(
    'typescript/src/generated/nodes.ts',
    '// Generated from Rust contracts. Do not edit.\n' +
      "import { DocumentSchema, type MutableNode as AstMutableNode, type MutableDocument as AstMutableDocument, type ReadonlyNode as AstReadonlyNode, type ReadonlyDocument as AstReadonlyDocument, type DeepReadonly } from '@traq-flavored-markdown/core';\n" +
      owners
        .map(
          g =>
            `import * as ${g} from '@traq-flavored-markdown/${nodeGroup(g).typescriptNodes}';`
        )
        .join('\n') +
      '\n' +
      `export type NodeVariant = ${owners.map(g => `${g}.NodeVariant`).join(' | ')};\n` +
      'export type MutableNode = AstMutableNode<NodeVariant>;\n' +
      'export type MutableDocument = AstMutableDocument<NodeVariant>;\n' +
      'export type ReadonlyNode = AstReadonlyNode<NodeVariant>;\n' +
      'export type ReadonlyDocument = AstReadonlyDocument<NodeVariant>;\n' +
      `export const names = Object.freeze({${owners.map(g => `...${g}.names`).join(',')}});\n` +
      `export const definitions = Object.freeze({${owners.map(g => `...${g}.definitions`).join(',')}});\n` +
      'export const schema = new DocumentSchema<NodeVariant>(Object.values(definitions));\n' +
      'export function isKnownNode<T extends {kind: string; data:unknown}>(node:T):node is T & DeepReadonly<NodeVariant> {return schema.isKnownNode(node);}\n'
  )
  return files
}
