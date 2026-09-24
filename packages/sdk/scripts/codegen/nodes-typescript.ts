import { nodeGroup } from '../../../../scripts/codegen/groups.ts'
import type { RawSchema } from '../../../../scripts/codegen/schema.ts'
import { typescriptDeclarations } from '../../../../scripts/codegen/typescript.ts'

export function typescriptFiles(manifest: {
  nodes: Record<string, { group: string }>
  parseError: RawSchema
}) {
  const files = new Map<string, string>()
  const owners = [...new Set(Object.values(manifest.nodes).map(n => n.group))]
  for (const group of owners) nodeGroup(group)
  files.set(
    'typescript/generated/nodes.ts',
    '// Generated from Rust contracts. Do not edit.\n' +
      "import type { Node as AstNode, Document as AstDocument } from '@traq-flavored-markdown/core';\n" +
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
      `const validators = new Map<string,(data:unknown)=>boolean>([${owners.map(g => `...${g}.nodes`).join(',')}]);\n` +
      'export const nodes: ReadonlyMap<string,(data:unknown)=>boolean> = new Map(validators);\n' +
      'export function isKnownNode(node:Node<true>):node is Node<true> & NodeKind {return validators.get(node.kind)?.(node.data) ?? false;}\n' +
      [...typescriptDeclarations([manifest.parseError]).values()].join('\n')
  )
  return files
}
