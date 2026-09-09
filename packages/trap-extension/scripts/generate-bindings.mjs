import { goNodes } from "@traq-markdown-parser/core/codegen/go";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { nodeFiles } from "@traq-markdown-parser/core/codegen/nodes";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const [group, crate] of [["trap", "markdown-trap-contracts"]]) {
  const input = path.join(root, "target", "typescript-contracts", group);
  execFileSync(
    "cargo",
    [
      "run",
      "--locked",
      "--offline",
      "-p",
      crate,
      "--features",
      "contracts",
      "--example",
      `export-${group}-types`,
      "--",
      input,
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  const manifest = JSON.parse(
    await readFile(path.join(input, "contracts.json")),
  );
  const goPath = path.join(
    root,
    "go",
    group === "generic" ? "generic" : "",
    "nodes_generated.go",
  );
  await mkdir(path.dirname(goPath), { recursive: true });
  const entries = Object.entries(manifest.nodes).map(([key, node]) => [
    key,
    node.schema,
  ]);
  await writeFile(goPath, goNodes(entries, group));
  execFileSync("gofmt", ["-w", goPath], { windowsHide: true });
  for (const [name, source] of await nodeFiles(manifest, input)) {
    const output = path.join(root, "typescript", "generated", name);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, source);
  }
}
