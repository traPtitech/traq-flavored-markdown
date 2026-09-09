import { readFile } from "node:fs/promises";
import path from "node:path";

export async function typescriptFiles(manifest, input) {
  const files = new Map();
  const owners = [
    ...new Set(Object.values(manifest.nodes).map((n) => n.group)),
  ];
  const packages = {
    commonmark: "commonmark/nodes",
    generic: "commonmark/generic/nodes",
    trap: "trap-extension/nodes",
  };
  files.set(
    "typescript/generated/nodes.ts",
    "// Generated from Rust contracts. Do not edit.\n" +
      "import type { Node as AstNode, Document as AstDocument } from '@traq-markdown-parser/core';\n" +
      owners
        .map(
          (g) =>
            `import * as ${g} from '@traq-markdown-parser/${packages[g] ?? g + "/nodes"}';`,
        )
        .join("\n") +
      "\n" +
      `export type NodeKind = ${owners.map((g) => `${g}.NodeKind`).join(" | ")};\n` +
      "export type Node<AllowUnknown extends boolean = false> =\n" +
      " AstNode<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;\n" +
      "export type Document<AllowUnknown extends boolean = false> = AstDocument<NodeKind | (AllowUnknown extends true ? {kind:string;data:unknown} : never)>;\n" +
      `export const names = Object.freeze({${owners.map((g) => `...${g}.names`).join(",")}});\n` +
      `export const nodes: ReadonlyMap<string,(data:unknown)=>boolean> = new Map([${owners.map((g) => `...${g}.nodes`).join(",")}]);\n` +
      "export function isKnownNode(node:Node<true>):node is Node<true> & NodeKind {return nodes.get(node.kind)?.(node.data) ?? false;}\n" +
      (await readFile(path.join(input, "ParseError.ts"), "utf8")).replace(
        /^\/\/[^\n]*\n/gm,
        "",
      ),
  );
  return files;
}
