import {
  block,
  lines,
  sourceFile
} from '../../../../tools/contracts/emitters/source.ts'
import { nodeGroup } from '../../../../tools/contracts/model/groups.ts'

export function typescriptFiles(manifest: {
  nodes: Record<string, { group: string }>
}) {
  const files = new Map<string, string>()
  const owners = [...new Set(Object.values(manifest.nodes).map(n => n.group))]

  for (const group of owners) nodeGroup(group)

  files.set(
    'typescript/src/generated/nodes.ts',
    sourceFile(
      lines(
        '// Generated from Rust contracts. Do not edit.',
        "import { DocumentSchema, type MutableNode as AstMutableNode, type MutableDocument as AstMutableDocument, type ReadonlyNode as AstReadonlyNode, type ReadonlyDocument as AstReadonlyDocument, type DeepReadonly } from '@traq-flavored-markdown/core';",
        owners.map(
          group =>
            `import * as ${group} from '@traq-flavored-markdown/${nodeGroup(group).typescriptNodes}';`
        )
      ),
      `export type NodeVariant = ${owners.map(group => `${group}.NodeVariant`).join(' | ')};`,
      lines(
        'export type MutableNode = AstMutableNode<NodeVariant>;',
        'export type MutableDocument = AstMutableDocument<NodeVariant>;',
        'export type ReadonlyNode = AstReadonlyNode<NodeVariant>;',
        'export type ReadonlyDocument = AstReadonlyDocument<NodeVariant>;'
      ),
      `export const names = Object.freeze({${owners.map(group => `...${group}.names`).join(',')}});`,
      `export const definitions = Object.freeze({${owners.map(group => `...${group}.definitions`).join(',')}});`,
      'export const schema = new DocumentSchema<NodeVariant>(Object.values(definitions));',
      block(
        'export function isKnownNode<T extends {kind: string; data:unknown}>(node:T):node is T & DeepReadonly<NodeVariant> {',
        'return schema.isKnownNode(node);'
      )
    )
  )

  return files
}
