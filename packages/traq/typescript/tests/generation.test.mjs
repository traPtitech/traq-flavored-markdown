import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { goNodes } from "@traq-markdown-parser/core/codegen/go";
import { nodeFiles } from "@traq-markdown-parser/core/codegen/nodes";
import { typescriptFiles } from "../../scripts/contracts/typescript.mjs";
import { presetFiles } from "../../scripts/contracts/presets.mjs";

test("new Rust-exported payloads and presets generate both host APIs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "markdown-contract-"));
  try {
    // The same inputs produced by ts-rs and schemars for a new Rust node.
    await writeFile(
      path.join(directory, "BadgeData.ts"),
      "export type BadgeData = { label:string; active:boolean };\n",
    );
    await writeFile(
      path.join(directory, "ParseError.ts"),
      'export type ParseError = {code:"internal_error"};\n',
    );
    const schema = {
      title: "BadgeData",
      type: "object",
      additionalProperties: false,
      properties: { label: { type: "string" }, active: { type: "boolean" } },
      required: ["label", "active"],
    };
    const key = "custom::BadgeData";

    const manifest = { nodes: { [key]: { schema, group: "custom" } } };
    const generated = await typescriptFiles(manifest, directory);
    assert.match(
      (await nodeFiles(manifest, directory)).get("custom.ts"),
      /kind: "custom::BadgeData"; data: BadgeData/,
    );
    assert.match(
      generated.get("typescript/generated/nodes.ts"),
      /custom.NodeKind/,
    );
    const go = goNodes([[key, schema]]);
    for (const expected of [
      /Label string/,
      /Active bool/,
      /case BadgeName: return &Badge\{\}/,
    ])
      assert.match(go, expected);
    assert.throws(
      () =>
        goNodes([
          [key, schema],
          ["another::BadgeData", schema],
        ]),
      /Duplicate generated payload type/,
    );
    const presets = presetFiles({ commonmark: 0, custom: { compact: 1 } });
    assert.match(
      presets.get("typescript/generated/presets.ts"),
      /"custom.compact"/,
    );
    assert.match(
      presets.get("go/presets_generated.go"),
      /PresetCustomCompact Preset = "custom.compact"/,
    );
  } finally {
    if (path.dirname(directory) !== path.resolve(tmpdir()))
      throw new Error("Unexpected temporary path");
    await rm(directory, { recursive: true, force: true });
  }
});

test("Rust processing options and nested results generate without host changes", async () => {
  const { processingFiles } =
    await import("../../scripts/contracts/processing.mjs");
  const directory = await mkdtemp(path.join(tmpdir(), "processing-contract-"));
  try {
    const object = (title, properties) => ({
      title,
      type: "object",
      additionalProperties: false,
      properties,
      required: Object.keys(properties),
    });
    const details = object("Details", {
      labels: { type: "array", items: { type: "string" } },
    });
    const options = object("ExtractorOptions", {
      compact: { type: "boolean" },
      details: { $ref: "#/$defs/Details" },
    });
    options.$defs = { Details: details };
    const output = object("Extraction", {
      details: { $ref: "#/$defs/Details" },
      batches: { type: "array", items: { $ref: "#/$defs/Details" } },
    });
    output.$defs = { Details: details };
    await writeFile(
      path.join(directory, "ExtractorOptions.ts"),
      'import type { Details } from "./Details.js";\nexport type ExtractorOptions = { compact:boolean; details:Details };',
    );
    await writeFile(
      path.join(directory, "Extraction.ts"),
      'import type { Details } from "./Details.js";\nexport type Extraction = { details:Details; batches:Array<Details> };',
    );
    await writeFile(
      path.join(directory, "Details.ts"),
      "export type Details = { labels:Array<string> };",
    );
    const schemas = {
      ExtractorOptions: options,
      Extraction: output,
    };
    const files = await processingFiles(schemas, directory);
    const go = files.get("go/processing_generated.go");
    assert.match(go, /Compact bool/);
    assert.match(go, /Batches \[\]Details/);
    assert.match(go, /Labels \[\]string/);
    assert.equal(go.match(/type Details struct/g).length, 1);
    const ts = files.get("typescript/generated/processing.ts");
    assert.match(ts, /compact:boolean/);
    assert.match(ts, /batches:Array<Details>/);
    assert.equal(ts.match(/export type Details/g).length, 1);
    output.$defs = {
      Details: object("Details", { other: { type: "boolean" } }),
    };
    await assert.rejects(
      processingFiles(schemas, directory),
      /Conflicting processing type/,
    );
  } finally {
    if (path.dirname(directory) !== path.resolve(tmpdir()))
      throw new Error("Unexpected temporary path");
    await rm(directory, { recursive: true, force: true });
  }
});
