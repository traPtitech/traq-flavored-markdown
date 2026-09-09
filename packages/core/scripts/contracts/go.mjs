import { shape, typeName, quoted as q } from "./schema.mjs";

const fieldName = (name) =>
  name === "id"
    ? "ID"
    : name.replace(/(^|_)([a-z])/g, (_, p, c) => c.toUpperCase());

function goType(s) {
  if (s.kind === "string" || s.kind === "enum") return "string";
  if (s.kind === "boolean") return "bool";
  if (s.kind === "integer") return s.format;
  if (s.kind === "nullable") return "*" + goType(s.inner);
  if (s.kind === "array") return "[]" + goType(s.items);
  if (s.kind === "object") return s.name ?? `struct {${fields(s)}}`;
  throw new Error("Unsupported Go field: " + s.kind);
}

const fields = (s) =>
  s.fields
    .map((f) => `${fieldName(f.name)} ${goType(f.shape)} \`json:${q(f.name)}\``)
    .join("\n");

export function goContract(schema, root = schema) {
  const contract = shape(schema, root);

  if (contract.kind === "enum") {
    return `type ${typeName(schema)} = string\n`;
  }

  return `type ${typeName(schema)} struct {\n${fields(contract)}\n}\n`;
}

export function goPayload(wireName, schema) {
  const name = typeName(schema),
    s = shape(schema);
  if (s.kind !== "object") throw new Error("Payload must be object");
  return (
    `const ${name}Name = ${q(wireName)}\ntype ${name} struct {\n` +
    s.fields
      .map(
        (f) => `${fieldName(f.name)} ${goType(f.shape)} \`json:${q(f.name)}\``,
      )
      .join("\n") +
    `\n}\nfunc (*${name}) NodePayload() {}\n`
  );
}

export function goNodes(entries, packageName = "nodes") {
  const names = entries.map(([, schema]) => typeName(schema));
  if (new Set(names).size !== names.length)
    throw new Error("Duplicate generated payload type");
  return (
    "// Code generated from Rust contracts. DO NOT EDIT.\npackage " +
    packageName +
    '\nimport "github.com/traq-markdown-parser/core/go/ast"\n' +
    entries.map(([key, schema]) => goPayload(key, schema)).join("\n") +
    "func NewPayload(kind string) ast.Payload {\nswitch kind {\n" +
    entries
      .map(
        ([, s]) =>
          "case " + typeName(s) + "Name: return &" + typeName(s) + "{}",
      )
      .join("\n") +
    "\n};return nil\n}\n"
  );
}
