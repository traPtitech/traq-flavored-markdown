export type NodeRole = 'block' | 'inline' | 'structural' | 'opaque'
export type NodeStructure = {
  role: NodeRole
  children:
    | { kind: 'leaf' | 'any' }
    | { kind: 'roles'; roles: NodeRole[]; nonempty: boolean }
    | { kind: 'types'; types: string[]; nonempty: boolean }
    | { kind: 'table'; header: string; row: string; columnsField: string }
}
