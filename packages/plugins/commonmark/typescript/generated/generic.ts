// Generated from Rust node payload types. Do not edit.
import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from Rust contracts. Do not edit.
export type BlockMathData = {
  tex: string
}
export type CellData = {
  alignment: Alignment | null
}
export type Alignment = 'left' | 'center' | 'right'
export type InlineMathData = {
  tex: string
}
export type MarkData = Record<string, never>
export type RowData = {
  header: boolean
}
export type StrikethroughData = Record<string, never>
export type TableData = Record<string, never>
export type NodeKind =
  | { kind: 'generic.block_math'; data: BlockMathData }
  | { kind: 'generic.cell'; data: CellData }
  | { kind: 'generic.inline_math'; data: InlineMathData }
  | { kind: 'generic.mark'; data: MarkData }
  | { kind: 'generic.row'; data: RowData }
  | { kind: 'generic.strikethrough'; data: StrikethroughData }
  | { kind: 'generic.table'; data: TableData }

export const names = Object.freeze({
  BlockMath: 'generic.block_math',
  Cell: 'generic.cell',
  InlineMath: 'generic.inline_math',
  Mark: 'generic.mark',
  Row: 'generic.row',
  Strikethrough: 'generic.strikethrough',
  Table: 'generic.table'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  [
    'generic.block_math',
    (value: unknown) => fields(value, { tex: string }, {})
  ],
  [
    'generic.cell',
    (value: unknown) =>
      fields(
        value,
        { alignment: nullable(oneOf('left', 'center', 'right')) },
        {}
      )
  ],
  [
    'generic.inline_math',
    (value: unknown) => fields(value, { tex: string }, {})
  ],
  ['generic.mark', (value: unknown) => fields(value, {}, {})],
  ['generic.row', (value: unknown) => fields(value, { header: boolean }, {})],
  ['generic.strikethrough', (value: unknown) => fields(value, {}, {})],
  ['generic.table', (value: unknown) => fields(value, {}, {})]
])
export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(
  validators
)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & NodeKind {
  return validators.get(node.kind)?.(node.data) ?? false
}
