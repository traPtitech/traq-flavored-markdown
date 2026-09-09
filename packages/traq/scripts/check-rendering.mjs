import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const [repo, allowed] of [
  ["core", []],
  ["commonmark", ["core", "commonmark"]],
  ["trap-extension", ["core", "commonmark", "trap-extension"]],
  ["traq", ["core", "commonmark", "trap-extension", "traq"]],
]) {
  const directory = path.resolve(root, "..", repo, "typescript");
  let count = 0;
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "tests") await visit(file);
        continue;
      }
      if (!file.endsWith(".ts")) continue;
      count++;
      const source = await readFile(file, "utf8");
      assert(
        !source.includes("@traptitech/traq-markdown-it"),
        file + ": retired package dependency",
      );
      for (const [, name] of source.matchAll(
        /from ['"]@traq-markdown-parser\/([^/'"]+)/g,
      ))
        assert(allowed.includes(name), file + ": upward dependency " + name);
      if (repo !== "core")
        assert(
          !/interface (?:Node|Document)\s*[<{]/.test(source),
          file + ": redeclared AST",
        );
    }
  }
  await visit(directory);
  console.log(
    repo + ": " + count + " TypeScript modules follow owner dependencies",
  );
}
