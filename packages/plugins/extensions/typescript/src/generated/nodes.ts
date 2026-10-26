// Generated from Rust node payload types. Do not edit.
import {
  type DeepReadonly,
  DocumentSchema,
  defineNode
} from '@traq-flavored-markdown/core'
import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from Rust contracts. Do not edit.
export type BlockMath = {
  tex: string
}
export type Cell = Record<string, never>
export type InlineMath = {
  tex: string
}
export type Mark = Record<string, never>
export type Row = Record<string, never>
export type Strikethrough = Record<string, never>
export type Table = {
  alignments: Array<Alignment | null>
}
export type Alignment = 'left' | 'center' | 'right'
export type HeaderRow = Record<string, never>
export type NodeVariant =
  | { kind: 'extensions.block_math'; data: BlockMath }
  | { kind: 'extensions.cell'; data: Cell }
  | { kind: 'extensions.inline_math'; data: InlineMath }
  | { kind: 'extensions.mark'; data: Mark }
  | { kind: 'extensions.row'; data: Row }
  | { kind: 'extensions.strikethrough'; data: Strikethrough }
  | { kind: 'extensions.table'; data: Table }
  | { kind: 'extensions.table_header_row'; data: HeaderRow }

function validateBlockMath(value: unknown): boolean {
  return ((value: unknown) => fields(value, { tex: string }, {}))(value)
}
function validateCell(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateInlineMath(value: unknown): boolean {
  return ((value: unknown) => fields(value, { tex: string }, {}))(value)
}
function validateMark(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateRow(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateStrikethrough(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
function validateTable(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        alignments: (value: unknown) =>
          Array.isArray(value) &&
          value.every(nullable(validateAlignment)) &&
          value.length >= 1
      },
      {}
    ))(value)
}
function validateAlignment(value: unknown): boolean {
  return oneOf('left', 'center', 'right')(value)
}
function validateHeaderRow(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, {}))(value)
}
export const names = Object.freeze({
  BlockMath: 'extensions.block_math',
  Cell: 'extensions.cell',
  InlineMath: 'extensions.inline_math',
  Mark: 'extensions.mark',
  Row: 'extensions.row',
  Strikethrough: 'extensions.strikethrough',
  Table: 'extensions.table',
  HeaderRow: 'extensions.table_header_row'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ['extensions.block_math', validateBlockMath],
  ['extensions.cell', validateCell],
  ['extensions.inline_math', validateInlineMath],
  ['extensions.mark', validateMark],
  ['extensions.row', validateRow],
  ['extensions.strikethrough', validateStrikethrough],
  ['extensions.table', validateTable],
  ['extensions.table_header_row', validateHeaderRow]
])
export const definitions = Object.freeze({
  BlockMath: defineNode<Extract<NodeVariant, { kind: typeof names.BlockMath }>>(
    names.BlockMath,
    validators.get(names.BlockMath)!,
    { role: 'block', children: { kind: 'leaf' } }
  ),
  Cell: defineNode<Extract<NodeVariant, { kind: typeof names.Cell }>>(
    names.Cell,
    validators.get(names.Cell)!,
    {
      role: 'structural',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  InlineMath: defineNode<
    Extract<NodeVariant, { kind: typeof names.InlineMath }>
  >(names.InlineMath, validators.get(names.InlineMath)!, {
    role: 'inline',
    children: { kind: 'leaf' }
  }),
  Mark: defineNode<Extract<NodeVariant, { kind: typeof names.Mark }>>(
    names.Mark,
    validators.get(names.Mark)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Row: defineNode<Extract<NodeVariant, { kind: typeof names.Row }>>(
    names.Row,
    validators.get(names.Row)!,
    {
      role: 'structural',
      children: { kind: 'types', types: ['extensions.cell'], nonempty: true }
    }
  ),
  Strikethrough: defineNode<
    Extract<NodeVariant, { kind: typeof names.Strikethrough }>
  >(names.Strikethrough, validators.get(names.Strikethrough)!, {
    role: 'inline',
    children: { kind: 'roles', roles: ['inline'], nonempty: false }
  }),
  Table: defineNode<Extract<NodeVariant, { kind: typeof names.Table }>>(
    names.Table,
    validators.get(names.Table)!,
    {
      role: 'block',
      children: {
        kind: 'sequence',
        prefix: ['extensions.table_header_row'],
        rest: 'extensions.row',
        arityField: 'alignments'
      }
    }
  ),
  HeaderRow: defineNode<Extract<NodeVariant, { kind: typeof names.HeaderRow }>>(
    names.HeaderRow,
    validators.get(names.HeaderRow)!,
    {
      role: 'structural',
      children: { kind: 'types', types: ['extensions.cell'], nonempty: true }
    }
  )
})
export const schema = new DocumentSchema<NodeVariant>(
  Object.values(definitions)
)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & DeepReadonly<NodeVariant> {
  return schema.isKnownNode(node)
}
