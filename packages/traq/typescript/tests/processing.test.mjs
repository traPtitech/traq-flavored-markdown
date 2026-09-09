import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRuntime, presets } from "../../dist/index.js";

const bytes = await readFile(
  new URL("../../dist/parser.wasm", import.meta.url),
);

test("processing consumes the supplied AST and returns metadata without rendering", async (t) => {
  const runtime = await createRuntime(bytes);
  t.after(() => runtime.dispose());
  const parser = runtime.createParser(presets.traq.v1);
  const extractor = runtime.createExtractor({
    origin: "https://q.example.test",
  });
  const source =
    '**!{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}**';
  const document = parser.parse(source);
  const original = structuredClone(document);
  const output = extractor.extract(document);
  assert.deepEqual(Object.keys(output).sort(), [
    "attachments",
    "citations",
    "embedding",
    "messageText",
    "references",
  ]);
  assert.equal(output.messageText, "**@alice**");
  assert.equal(output.references.mentions.length, 1);
  assert.deepEqual(extractor.extract(document), output);
  assert.deepEqual(document, original);
  assert.throws(() => extractor.extract(source));
  const invalid = structuredClone(document);
  invalid.children[0].span.end = source.length + 1;
  assert.throws(() => extractor.extract(invalid));
  assert.deepEqual(extractor.extract(document), output);
});

test("one extractor accepts ASTs from different grammar versions", async (t) => {
  const runtime = await createRuntime(bytes);
  t.after(() => runtime.dispose());
  const parsers = new Map(
    ["commonmark", "traq.v1"].map((version) => [
      version,
      runtime.createParser(version),
    ]),
  );
  const extractor = runtime.createExtractor({ origin: "" });
  const source =
    '!{"type":"user","id":"00000000-0000-0000-0000-000000000001","raw":"@alice"}';
  for (const version of ["commonmark", "traq.v1", "commonmark"]) {
    const output = extractor.extract(parsers.get(version).parse(source));
    assert.equal(
      output.references.mentions.length,
      version === "commonmark" ? 0 : 1,
    );
  }
  assert.throws(
    () => runtime.createParser("traq.unknown"),
    /unknown grammar version/,
  );
});

test("AST processing configuration and instances have independent lifetimes", async () => {
  const runtime = await createRuntime(bytes);
  try {
    const parser = runtime.createParser(presets.traq.v1);
    const source =
      "https://q.example.test/files/00000000-0000-0000-0000-000000000001";
    const document = parser.parse(source);
    const options = { origin: "https://q.example.test" };
    const configured = runtime.createExtractor(options);
    options.origin = "changed";
    const plain = runtime.createExtractor({ origin: "" });
    assert.equal(configured.extract(document).attachments.length, 1);
    assert.equal(plain.extract(document).attachments.length, 0);
    for (const options of [{ origin: "x".repeat(2049) }, { extra: true }]) {
      assert.throws(() => runtime.createExtractor(options));
    }
    const large = parser.parse("x".repeat(60000));
    assert.equal(plain.extract(large).messageText, large.source);
    configured.dispose();
    configured.dispose();
    assert.throws(() => configured.extract(document), /disposed/);
    assert.equal(plain.extract(document).messageText, source);
    runtime.dispose();
    assert.throws(() => plain.extract(document), /disposed/);
    assert.throws(() => runtime.createExtractor({ origin: "" }), /disposed/);
  } finally {
    runtime.dispose();
  }
});
