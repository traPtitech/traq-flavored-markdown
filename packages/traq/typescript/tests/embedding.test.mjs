import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createRuntime,
  presets,
  embedReferences,
  mentionsUser,
} from "../../dist/index.js";

const bytes = await readFile(
  new URL("../../dist/parser.wasm", import.meta.url),
);
const fixtures = JSON.parse(
  await readFile(
    new URL("../../tests/fixtures/embedding.json", import.meta.url),
    "utf8",
  ),
);

const userId = "dfdff0c9-5de0-46ee-9721-2525e8bb3d44";
const groupId = "dfabf0c9-5de0-46ee-9721-2525e8bb3d45";
const identities = {
  user: {
    a: userId,
    takashi_trap: "dfdff0c9-5de0-46ee-9721-2525e8bb3d45",
    takashi_trape: "dfdff0c9-5de0-46ee-9721-2525e8bb3d46",
    very_long_long_long_long_lo_name: "dfdff0c9-5de0-46ee-9721-2525e8bb3d47",
  },
  group: {
    okあok: groupId,
    takashi_trapo: "dfabf0c9-5de0-46ee-9721-2525e8bb3d46",
    'a"b': groupId,
  },
  channel: { a: "ea452867-553b-4808-a14f-a47ee0009ee6", 64: userId },
};

test("embedding and restoration use Rust AST ranges without reparsing source text", async () => {
  const runtime = await createRuntime(bytes);
  const parser = runtime.createParser(presets.traq.v1);
  const extractor = runtime.createExtractor({ origin: "" });
  const process = (source) => extractor.extract(parser.parse(source));
  const embed = (source) =>
    embedReferences(
      source,
      process(source).embedding,
      (kind, name) => identities[kind]?.[name],
    );

  try {
    for (const [source, expected] of fixtures) {
      assert.equal(embed(source), expected, source);
    }

    const reference = `!${JSON.stringify({ type: "user", raw: "@a", id: userId })}`;
    const preserved = [
      "~~~\n@a\n~~~",
      "> ```\n> @a\n> ```",
      "    @a",
      "[label @a](https://example.com/@a)",
      "![alt @a](https://example.com/image.png)",
      "\\@a &#64;a \\#a",
      reference,
      `\`${reference}\``,
    ];

    for (const source of preserved) {
      assert.equal(embed(source), source, source);
    }

    assert.equal(embed("日本語😀 **@a**"), `日本語😀 **${reference}**`);

    const escaped = embed('@a"b');
    assert.equal(process(escaped).embedding.unembeddedText, '@a"b');

    const linkedReference = "[label " + reference + "](https://example.com)";
    assert.equal(
      process(linkedReference).embedding.unembeddedText,
      "[label @a](https://example.com)",
    );

    for (const protectedSource of [
      "\x60\x60\x60\n" + reference + "\n\x60\x60\x60",
      "$$\n" + reference + "\n$$",
    ]) {
      assert.equal(
        process(protectedSource).embedding.unembeddedText,
        protectedSource,
      );
    }

    const source = `日本語😀 ${reference} \`${reference}\` !!${reference}!!`;
    const output = process(source);
    assert.equal(
      output.embedding.unembeddedText,
      `日本語😀 @a \`${reference}\` !!@a!!`,
    );
    assert.equal(mentionsUser(output.references, userId, []), true);
    assert.equal(
      mentionsUser(process(`\`${reference}\``).references, userId, []),
      false,
    );

    const groupReference =
      "!" + JSON.stringify({ type: "group", raw: "@group", id: groupId });
    assert.equal(
      mentionsUser(process(groupReference).references, userId, [groupId]),
      true,
    );
    assert.equal(
      mentionsUser(process(groupReference).references, userId, []),
      false,
    );
    assert.equal(
      mentionsUser(process(reference).references, groupId, []),
      false,
    );
    assert.equal(
      mentionsUser(process("!{invalid:json}").references, userId, [groupId]),
      false,
    );
    assert.equal(
      mentionsUser(process("").references, userId, [groupId]),
      false,
    );

    assert.throws(
      () => embedReferences("different", process("@a").embedding, () => userId),
      /does not match source/,
    );
  } finally {
    runtime.dispose();
  }
});
