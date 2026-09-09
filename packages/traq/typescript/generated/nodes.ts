// Generated from Rust contracts. Do not edit.
import type { Node as AstNode, Document as AstDocument } from '@traq-markdown-parser/core';
import * as commonmark from '@traq-markdown-parser/commonmark/nodes';
import * as generic from '@traq-markdown-parser/commonmark/generic/nodes';
import * as trap from '@traq-markdown-parser/trap-extension/nodes';
export type NodeKind = commonmark.NodeKind | generic.NodeKind | trap.NodeKind;
export type Node<AllowUnknown extends boolean = false> =
 AstNode<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;
export type Document<AllowUnknown extends boolean = false> = AstDocument<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;
export const names = Object.freeze({...commonmark.names,...generic.names,...trap.names});
export const nodes: ReadonlyMap<string,(data:unknown)=>boolean> = new Map([...commonmark.nodes,...generic.nodes,...trap.nodes]);
export function isKnownNode(node:Node<true>):node is Node<true> & NodeKind {return nodes.get(node.kind)?.(node.data) ?? false;}

export type ParseError = { "code": "invalid_utf8" } | { "code": "resource_limit", resource: string, } | { "code": "internal_error" };
