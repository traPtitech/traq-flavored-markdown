import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shape } from "@traq-markdown-parser/core/codegen/schema";
import { javascript } from "@traq-markdown-parser/core/codegen/javascript";
import { goPayload } from "@traq-markdown-parser/core/codegen/go";
import { nodes, names } from "../../dist/generated/nodes.js";

const manifest = JSON.parse(
  await readFile(
    new URL("../../target/node-contracts/contracts.json", import.meta.url),
  ),
);

function example(s) {
  if (s.kind === "string") return "value";
  if (s.kind === "integer") return s.min;
  if (s.kind === "boolean") return false;
  if (s.kind === "enum") return s.values[0];
  if (s.kind === "nullable") return null;
  return Object.fromEntries(s.fields.map((f) => [f.name, example(f.shape)]));
}

test("generated optional TypeScript guards enforce every exported payload shape", () => {
  for (const [name, schema] of Object.entries(manifest.nodes).map(
    ([key, value]) => [key, value.schema],
  )) {
    const valid = example(shape(schema)),
      check = nodes.get(name);
    assert(check(valid), name);
    assert(!check({ ...valid, unexpected: true }), name);
    assert(!check(null), name);
    for (const field of schema.required ?? []) {
      const missing = { ...valid };
      delete missing[field];
      assert(!check(missing), name + " missing " + field);
      assert(!check({ ...valid, [field]: [] }), name + " field " + field);
    }
  }
  assert(
    !nodes.get(names.Reference)({
      type: "other",
      id: "u",
      label: "@u",
    }),
  );
  assert(!nodes.get(names.Cell)({ alignment: "other" }));
});

test("unsupported schema constraints fail generation instead of weakening validation", () => {
  const schema = {
    title: "Example",
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "string", pattern: "secret" } },
    required: ["value"],
  };
  assert.throws(
    () => javascript([["test/example@1", schema]]),
    /Unsupported schema keyword/,
  );
  assert.throws(
    () => goPayload("test/example@1", schema),
    /Unsupported schema keyword/,
  );
  for (const unsupported of [
    { type: ["string", "null"], enum: ["restricted", null] },
    { type: "string", anyOf: [{ type: "string" }, { type: "null" }] },
    { $ref: "#/$defs/Value", type: "boolean" },
    { anyOf: [{ type: "string" }, { type: "null", enum: [null] }] },
  ])
    assert.throws(() => shape(unsupported), /Unsupported schema keyword/);
  const recursive = { $ref: "#/$defs/Value" };
  assert.throws(
    () => shape(recursive, { $defs: { Value: recursive } }),
    /Recursive payload schemas/,
  );
  const plain = { ...schema, properties: { value: { type: "string" } } };
  assert.throws(
    () =>
      javascript([
        ["test/example@1", plain],
        ["other/example@1", { ...plain, title: "ExampleData" }],
      ]),
    /Duplicate generated payload type/,
  );
});
