export type NodeRole = 'block' | 'inline' | 'structural' | 'opaque'
export type NodeStructure = {
  role: NodeRole
  children:
    | { kind: 'leaf' | 'any' }
    | { kind: 'roles'; roles: NodeRole[]; nonempty: boolean }
    | { kind: 'types'; types: string[]; nonempty: boolean }
    | { kind: 'sequence'; prefix: string[]; rest: string; arityField?: string }
}
