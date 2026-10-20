/** Ownership of each Rust node contract group in the host packages. */
export const nodeGroups = {
  commonmark: {
    owner: 'commonmark-plugin',
    crate: 'markdown-commonmark-contracts',
    typescriptNodes: 'commonmark-plugin/nodes',
    typescriptGeneratedPath: 'typescript/generated/commonmark.ts',
    goPackage: 'plugins/commonmark/go',
    goGeneratedPath: 'go/generated_nodes.go'
  },
  generic: {
    owner: 'extensions-plugin',
    crate: 'markdown-generic-contracts',
    typescriptNodes: 'extensions-plugin/nodes',
    typescriptGeneratedPath: 'typescript/generated/nodes.ts',
    goPackage: 'plugins/extensions/go',
    goGeneratedPath: 'go/generated_nodes.go'
  },
  trap: {
    owner: 'traq-plugin',
    crate: 'markdown-trap-contracts',
    typescriptNodes: 'traq-plugin/nodes',
    typescriptGeneratedPath: 'typescript/generated/trap.ts',
    goPackage: 'plugins/traq/go',
    goGeneratedPath: 'go/generated_nodes.go'
  }
} as const

export type NodeGroup = keyof typeof nodeGroups
export type ContractPackage = (typeof nodeGroups)[NodeGroup]['owner']

export function nodeGroup(name: string) {
  if (!Object.hasOwn(nodeGroups, name))
    throw new Error('Unknown node contract group: ' + name)
  return nodeGroups[name as NodeGroup]
}
