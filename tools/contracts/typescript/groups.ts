/** Ownership of each Rust node contract group in the host packages. */
export const nodeGroups = {
  commonmark: {
    wirePrefixes: ['commonmark'],
    owner: 'commonmark-plugin',
    crate: 'markdown-commonmark-contracts',
    typescriptNodes: 'commonmark-plugin/nodes',
    typescriptGeneratedPath: 'typescript/src/generated/commonmark.ts',
    goPackage: 'plugins/commonmark/go',
    goGeneratedPath: 'go/generated_nodes.go'
  },
  extensions: {
    // Historical serialized node kinds keep their independent wire namespace.
    wirePrefixes: ['generic'],
    owner: 'extensions-plugin',
    crate: 'markdown-extensions-contracts',
    typescriptNodes: 'extensions-plugin/nodes',
    typescriptGeneratedPath: 'typescript/src/generated/nodes.ts',
    goPackage: 'plugins/extensions/go',
    goGeneratedPath: 'go/generated_nodes.go'
  },
  trap: {
    wirePrefixes: ['traq'],
    owner: 'traq-plugin',
    crate: 'markdown-trap-contracts',
    typescriptNodes: 'traq-plugin/nodes',
    typescriptGeneratedPath: 'typescript/src/generated/trap.ts',
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

export function assertNodeGroup(
  group: string,
  nodes: Readonly<Record<string, { group: string }>>
) {
  const metadata = nodeGroup(group)
  for (const [kind, node] of Object.entries(nodes)) {
    if (node.group !== group)
      throw new Error(
        `${kind}: expected ${group} contract group, got ${node.group}`
      )
    if (!metadata.wirePrefixes.some(prefix => kind.startsWith(prefix + '.')))
      throw new Error(
        `${kind}: expected ${metadata.wirePrefixes.join(' or ')} wire namespace for ${group}`
      )
  }
}
