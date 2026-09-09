import { shape, typeName, quoted as q } from "./schema.mjs";

function validator(s) {
  if (s.kind === "string" || s.kind === "boolean") return s.kind;
  if (s.kind === "integer")
    return `(value) => typeof value === "number" && Number.isInteger(value) && value >= ${s.min} && value <= ${s.max}`;
  if (s.kind === "enum") return "oneOf(" + s.values.map(q).join(",") + ")";
  if (s.kind === "nullable") return "nullable(" + validator(s.inner) + ")";
  if (s.kind === "object") {
    const fields = (required) =>
      "{" +
      s.fields
        .filter((f) => f.required === required)
        .map((f) => q(f.name) + ":" + validator(f.shape))
        .join(",") +
      "}";
    return "value => fields(value," + fields(true) + "," + fields(false) + ")";
  }
  throw new Error("Unsupported validator");
}

export function javascript(entries, fieldsImport = "../fields.js") {
  const used = new Set();
  for (const [, schema] of entries) {
    const name = typeName(schema).toLowerCase();
    if (used.has(name))
      throw new Error("Duplicate generated payload type: " + name);
    used.add(name);
  }

  return (
    "// Generated from Rust node payload types. Do not edit.\n" +
    "import {fields,string,boolean,nullable,oneOf} from " +
    q(fieldsImport) +
    "\n" +
    "export const names = Object.freeze(" +
    q(
      Object.fromEntries(
        entries.map(([name, schema]) => [typeName(schema), name]),
      ),
    ) +
    " as const)\n" +
    "const validators = new Map<string, (data: unknown) => boolean>([\n" +
    entries
      .map(
        ([name, schema]) =>
          "  [" + q(name) + "," + validator(shape(schema)) + "],",
      )
      .join("\n") +
    "\n])\n" +
    "export const nodes: ReadonlyMap<string, (data: unknown) => boolean> = new Map(validators)\n" +
    "// Check this payload only; children can still contain unknown nodes.\n" +
    "export function isKnownNode<T extends {kind: string; data: unknown}>(node: T): node is T & NodeKind {\n" +
    "  return validators.get(node.kind)?.(node.data) ?? false\n" +
    "}\n"
  );
}
