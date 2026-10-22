// Generated from Rust node payload types. Do not edit.
import { defineNode } from '@traq-flavored-markdown/core'
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
export type NodeKind =
  | { kind: 'generic.block_math'; data: BlockMath }
  | { kind: 'generic.cell'; data: Cell }
  | { kind: 'generic.inline_math'; data: InlineMath }
  | { kind: 'generic.mark'; data: Mark }
  | { kind: 'generic.row'; data: Row }
  | { kind: 'generic.strikethrough'; data: Strikethrough }
  | { kind: 'generic.table'; data: Table }
  | { kind: 'generic.table_header_row'; data: HeaderRow }

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
  BlockMath: 'generic.block_math',
  Cell: 'generic.cell',
  InlineMath: 'generic.inline_math',
  Mark: 'generic.mark',
  Row: 'generic.row',
  Strikethrough: 'generic.strikethrough',
  Table: 'generic.table',
  HeaderRow: 'generic.table_header_row'
} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ['generic.block_math', validateBlockMath],
  ['generic.cell', validateCell],
  ['generic.inline_math', validateInlineMath],
  ['generic.mark', validateMark],
  ['generic.row', validateRow],
  ['generic.strikethrough', validateStrikethrough],
  ['generic.table', validateTable],
  ['generic.table_header_row', validateHeaderRow]
])
export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(
  validators
)
export const definitions = Object.freeze({
  BlockMath: defineNode<Extract<NodeKind, { kind: typeof names.BlockMath }>>(
    names.BlockMath,
    validators.get(names.BlockMath)!,
    { role: 'block', children: { kind: 'leaf' } }
  ),
  Cell: defineNode<Extract<NodeKind, { kind: typeof names.Cell }>>(
    names.Cell,
    validators.get(names.Cell)!,
    {
      role: 'structural',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  InlineMath: defineNode<Extract<NodeKind, { kind: typeof names.InlineMath }>>(
    names.InlineMath,
    validators.get(names.InlineMath)!,
    { role: 'inline', children: { kind: 'leaf' } }
  ),
  Mark: defineNode<Extract<NodeKind, { kind: typeof names.Mark }>>(
    names.Mark,
    validators.get(names.Mark)!,
    {
      role: 'inline',
      children: { kind: 'roles', roles: ['inline'], nonempty: false }
    }
  ),
  Row: defineNode<Extract<NodeKind, { kind: typeof names.Row }>>(
    names.Row,
    validators.get(names.Row)!,
    {
      role: 'structural',
      children: { kind: 'types', types: ['generic.cell'], nonempty: true }
    }
  ),
  Strikethrough: defineNode<
    Extract<NodeKind, { kind: typeof names.Strikethrough }>
  >(names.Strikethrough, validators.get(names.Strikethrough)!, {
    role: 'inline',
    children: { kind: 'roles', roles: ['inline'], nonempty: false }
  }),
  Table: defineNode<Extract<NodeKind, { kind: typeof names.Table }>>(
    names.Table,
    validators.get(names.Table)!,
    {
      role: 'block',
      children: {
        kind: 'sequence',
        prefix: ['generic.table_header_row'],
        rest: 'generic.row',
        arityField: 'alignments'
      }
    }
  ),
  HeaderRow: defineNode<Extract<NodeKind, { kind: typeof names.HeaderRow }>>(
    names.HeaderRow,
    validators.get(names.HeaderRow)!,
    {
      role: 'structural',
      children: { kind: 'types', types: ['generic.cell'], nonempty: true }
    }
  )
})
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends { kind: string; data: unknown }>(
  node: T
): node is T & NodeKind {
  return validators.get(node.kind)?.(node.data) ?? false
}
