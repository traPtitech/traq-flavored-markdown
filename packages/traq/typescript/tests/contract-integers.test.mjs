import assert from "node:assert/strict";
import { test } from "node:test";
import { javascript } from "@traq-markdown-parser/core/codegen/javascript";
import { goPayload } from "@traq-markdown-parser/core/codegen/go";
import { shape } from "@traq-markdown-parser/core/codegen/schema";
import ts from "typescript";

test("generated numeric payload validators retain Rust integer bounds", async () => {
  for (const [format, maximum] of [
    ["uint8", 255],
    ["uint32", 0xffffffff],
  ]) {
    const schema = {
      title: "Numeric",
      type: "object",
      additionalProperties: false,
      properties: { value: { type: "integer", format, minimum: 0, maximum } },
      required: ["value"],
    };
    const generated = javascript(
      [["example::Numeric", schema]],
      import.meta.resolve("@traq-markdown-parser/core/validation"),
    );
    const compiled = ts.transpileModule(generated, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    const { nodes } = await import(
      "data:text/javascript," + encodeURIComponent(compiled)
    );
    const validate = nodes.get("example::Numeric");
    for (const value of [0, 1, maximum])
      assert.equal(validate({ value }), true);
    for (const value of [-1, maximum + 1, 0.5, null, "1", NaN, Infinity])
      assert.equal(validate({ value }), false);
    assert.equal(validate({}), false);
    assert.equal(validate({ value: 1, extra: 1 }), false);
    assert.match(
      goPayload("example::Numeric", schema),
      new RegExp("Value " + format),
    );
    assert.throws(
      () => shape({ ...schema.properties.value, maximum: 6 }),
      /Unsupported integer/,
    );
    assert.throws(
      () => shape({ ...schema.properties.value, multipleOf: 2 }),
      /Unsupported schema keyword/,
    );
    const withoutMaximum = { ...schema.properties.value };
    delete withoutMaximum.maximum;
    assert.equal(shape(withoutMaximum).max, maximum);
  }
});
