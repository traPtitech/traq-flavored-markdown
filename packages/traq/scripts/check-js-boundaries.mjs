const { readFile } = await import("node:fs/promises");
const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root)));
const { default: assert } = await import("node:assert/strict");
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
await import("./check-rendering.mjs");
const { execFileSync } = await import("node:child_process");
for (const name of [
  "traq-markdown-processing",
  "markdown-trap-text",
  "markdown-trap-extraction",
  "markdown-trap-contracts",
]) {
  const tree = execFileSync(
    "cargo",
    ["tree", "--locked", "-p", name, "--edges", "normal"],
    { cwd: root, encoding: "utf8" },
  );
  assert(
    !/markdown-parser v|markdown-codec v|traq-markdown-grammar v|traq-markdown-wasm v/.test(
      tree,
    ),
    name +
      ": lower-level processing must not depend on parsing or distribution",
  );
}
const syntax = execFileSync(
  "cargo",
  ["tree", "--locked", "-p", "markdown-trap-syntax", "--edges", "normal"],
  { cwd: root, encoding: "utf8" },
);
assert(
  !/traq-markdown-grammar v|traq-markdown-wasm v/.test(syntax),
  "Extension syntax must not depend on the traQ distribution",
);
console.log(
  "Dependency direction: extension components and processing presets do not depend on the distribution",
);
