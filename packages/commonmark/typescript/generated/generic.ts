// Generated from Rust contracts. Do not edit.
export type MarkData = Record<symbol, never>;
export type BlockMathData = { tex: string, };
export type InlineMathData = { tex: string, };
export type StrikethroughData = Record<symbol, never>;
export type CellData = { alignment: Alignment | null, };
export type Alignment = "left" | "center" | "right";
export type RowData = { header: boolean, };
export type TableData = Record<symbol, never>;
export type NodeKind =
 | { kind: "markdown_generic_contracts::mark::MarkData"; data: MarkData }
 | { kind: "markdown_generic_contracts::math::BlockMathData"; data: BlockMathData }
 | { kind: "markdown_generic_contracts::math::InlineMathData"; data: InlineMathData }
 | { kind: "markdown_generic_contracts::strikethrough::StrikethroughData"; data: StrikethroughData }
 | { kind: "markdown_generic_contracts::table::CellData"; data: CellData }
 | { kind: "markdown_generic_contracts::table::RowData"; data: RowData }
 | { kind: "markdown_generic_contracts::table::TableData"; data: TableData };
// Generated from Rust node payload types. Do not edit.
import {fields,string,boolean,nullable,oneOf} from "@traq-markdown-parser/core/validation"
export const names = Object.freeze({"Mark":"markdown_generic_contracts::mark::MarkData","BlockMath":"markdown_generic_contracts::math::BlockMathData","InlineMath":"markdown_generic_contracts::math::InlineMathData","Strikethrough":"markdown_generic_contracts::strikethrough::StrikethroughData","Cell":"markdown_generic_contracts::table::CellData","Row":"markdown_generic_contracts::table::RowData","Table":"markdown_generic_contracts::table::TableData"} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ["markdown_generic_contracts::mark::MarkData",value => fields(value,{},{})],
  ["markdown_generic_contracts::math::BlockMathData",value => fields(value,{"tex":string},{})],
  ["markdown_generic_contracts::math::InlineMathData",value => fields(value,{"tex":string},{})],
  ["markdown_generic_contracts::strikethrough::StrikethroughData",value => fields(value,{},{})],
  ["markdown_generic_contracts::table::CellData",value => fields(value,{"alignment":nullable(oneOf("left","center","right"))},{})],
  ["markdown_generic_contracts::table::RowData",value => fields(value,{"header":boolean},{})],
  ["markdown_generic_contracts::table::TableData",value => fields(value,{},{})],
])
export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(validators)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends {kind: string; data: unknown}>(node: T): node is T & NodeKind {
  return validators.get(node.kind)?.(node.data) ?? false
}
