import { readFile } from "node:fs/promises";
import path from "node:path";
import { goContract } from "@traq-markdown-parser/core/codegen/go";

export async function processingFiles(schemas, input) {
  const files = new Map([
    [
      "typescript/generated/processing.ts",
      "// Generated from Rust processing contracts. Do not edit.\n",
    ],
    [
      "go/processing_generated.go",
      "// Code generated from Rust processing contracts. DO NOT EDIT.\npackage markdown\n",
    ],
  ]);
  const types = new Map();
  async function declaration(name) {
    if (types.has(name)) return;
    const source = await readFile(path.join(input, name + ".ts"), "utf8");
    types.set(
      name,
      source
        .replace(/\r\n/g, "\n")
        .replace(/^\/\/[^\n]*\n/gm, "")
        .replace(/^import type .*;\r?\n/gm, "")
        .replace(/[ \t]+$/gm, "")
        .trim(),
    );
    for (const match of source.matchAll(/from ["']\.\/([^"']+)\.js["']/g))
      await declaration(match[1]);
  }

  let go = "";
  const declarations = new Map();
  function addGo(schema, root = schema) {
    const source = goContract(schema, root);
    const previous = declarations.get(schema.title);
    if (previous !== undefined && previous !== source)
      throw new Error("Conflicting processing type: " + schema.title);
    if (previous === undefined) {
      declarations.set(schema.title, source);
      go += source;
    }
  }

  for (const name of Object.keys(schemas)) {
    await declaration(name);
    const schema = schemas[name];
    addGo(schema);
    for (const [name, definition] of Object.entries(schema.$defs ?? {}))
      addGo({ ...definition, title: name }, schema);
  }
  const tsPath = "typescript/generated/processing.ts";
  const goPath = "go/processing_generated.go";
  files.set(tsPath, files.get(tsPath) + [...types.values()].join("\n") + "\n");
  files.set(goPath, files.get(goPath) + go);
  return files;
}
