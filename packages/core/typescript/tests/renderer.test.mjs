import test from "node:test";
import assert from "node:assert/strict";
import {
  renderer,
  Plugin,
  PresetBuilder,
} from "@traq-markdown-parser/core/renderer";
import { Plugin as Declaration } from "@traq-markdown-parser/core/definitions";
test("core renders custom AST nodes without a grammar or Wasm runtime", () => {
  const declaration = new Declaration("custom");
  const plugin = new Plugin(declaration).on("text", (n, c) => c.escape(n.data));
  const builder = new PresetBuilder().add(plugin);
  const view = renderer(builder.build());
  const document = {
    source: "<猫>",
    children: [{ kind: "text", data: "<猫>", span: { start: 0, end: 5 } }],
  };
  assert.equal(view.render(document), "&lt;猫&gt;");
  plugin.replace("text", () => "<b>changed</b>");
  assert.equal(view.render(document), "&lt;猫&gt;");
  assert.equal(
    renderer(new PresetBuilder().build()).render(document),
    "&lt;猫&gt;",
  );
  assert.throws(
    () => new PresetBuilder().add(plugin).add(plugin),
    /Duplicate plugin/,
  );
});

test("fallback and child rendering have no block or inline mode", () => {
  const declaration = new Declaration("containers");
  const plugin = new Plugin(declaration)
    .on("container", (node, ctx) => {
      assert.equal(ctx.inline, undefined);
      assert.equal(ctx.blocks, undefined);
      return ctx.render(node.children);
    })
    .on("explicit", (node, ctx) => ctx.fallback(node));
  const builder = new PresetBuilder().add(plugin);
  const options = { fallback: (text) => "<aside>" + text + "</aside>" };
  const custom = renderer(builder.build(options));
  options.fallback = () => "changed";
  const plain = renderer(builder.build());
  const leaf = { kind: "unknown", data: {}, span: { start: 0, end: 5 } };
  const document = { source: "<猫>", children: [leaf] };
  for (const view of [plain, custom])
    assert.deepEqual(Object.keys(view), ["render"]);
  for (const kind of ["unknown", "explicit", "container"]) {
    const input = {
      ...document,
      children: [{ ...leaf, kind, children: [leaf] }],
    };
    assert.equal(plain.render(input), "&lt;猫&gt;");
    assert.equal(custom.render(input), "<aside>&lt;猫&gt;</aside>");
  }
  assert.throws(
    () => builder.build({ fallback: 42 }),
    /Expected render fallback/,
  );
  assert.throws(
    () => renderer(builder.build({ fallback: () => [] })).render(document),
    /HTML string/,
  );
});
