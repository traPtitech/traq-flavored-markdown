// Generated from Rust contracts. Do not edit.
export type BlankLineData = Record<symbol, never>;
export type EmbeddingData = { type: EmbeddingKind, id: string, label: string,
/**
 * Original JSON notation, available to renderers that display it as text.
 */
literal: string, };
export type EmbeddingKind = "file" | "message";
export type ReferenceData = { type: ReferenceKind, id: string, label: string, };
export type ReferenceKind = "user" | "group" | "channel";
export type SpoilerData = Record<symbol, never>;
export type StampData = { literal: string, };
export type NodeKind =
 | { kind: "markdown_trap_contracts::compat::BlankLineData"; data: BlankLineData }
 | { kind: "markdown_trap_contracts::embedding::EmbeddingData"; data: EmbeddingData }
 | { kind: "markdown_trap_contracts::reference::ReferenceData"; data: ReferenceData }
 | { kind: "markdown_trap_contracts::spoiler::SpoilerData"; data: SpoilerData }
 | { kind: "markdown_trap_contracts::stamp::StampData"; data: StampData };
// Generated from Rust node payload types. Do not edit.
import {fields,string,boolean,nullable,oneOf} from "@traq-markdown-parser/core/validation"
export const names = Object.freeze({"BlankLine":"markdown_trap_contracts::compat::BlankLineData","Embedding":"markdown_trap_contracts::embedding::EmbeddingData","Reference":"markdown_trap_contracts::reference::ReferenceData","Spoiler":"markdown_trap_contracts::spoiler::SpoilerData","Stamp":"markdown_trap_contracts::stamp::StampData"} as const)
const validators = new Map<string, (data: unknown) => boolean>([
  ["markdown_trap_contracts::compat::BlankLineData",value => fields(value,{},{})],
  ["markdown_trap_contracts::embedding::EmbeddingData",value => fields(value,{"id":string,"label":string,"literal":string,"type":oneOf("file","message")},{})],
  ["markdown_trap_contracts::reference::ReferenceData",value => fields(value,{"id":string,"label":string,"type":oneOf("user","group","channel")},{})],
  ["markdown_trap_contracts::spoiler::SpoilerData",value => fields(value,{},{})],
  ["markdown_trap_contracts::stamp::StampData",value => fields(value,{"literal":string},{})],
])
export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(validators)
// Check this payload only; children can still contain unknown nodes.
export function isKnownNode<T extends {kind: string; data: unknown}>(node: T): node is T & NodeKind {
  return validators.get(node.kind)?.(node.data) ?? false
}
