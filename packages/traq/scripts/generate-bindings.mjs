import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { typescriptFiles } from "./contracts/typescript.mjs";
import { goNodes } from "./contracts/go.mjs";
import { presetFiles } from "./contracts/presets.mjs";
import { processingFiles } from "./contracts/processing.mjs";

const input = path.resolve(process.argv[2] ?? "target/node-contracts");
const manifest = JSON.parse(await readFile(path.join(input, "contracts.json")));
const entries = Object.entries(manifest.nodes).map(([key, node]) => [
  key,
  node.schema,
]);
const files = await typescriptFiles(manifest, input);
files.set("go/nodes_generated.go", goNodes(manifest));
for (const [name, source] of presetFiles(manifest.presets))
  files.set(name, source);
for (const [name, source] of await processingFiles(manifest.processing, input))
  files.set(name, source);

files.set(
  "typescript/generated/artifact.ts",
  `// Generated for this Wasm build. Do not edit.\nexport const buildId = '${manifest.buildId}';\nexport const inputBytes = ${manifest.limits.inputBytes};\n`,
);
files.set(
  "go/artifact_generated.go",
  `// Code generated for this Wasm build. DO NOT EDIT.\npackage markdown\nconst buildID = "${manifest.buildId}"\nconst inputBytes = ${manifest.limits.inputBytes}\nconst memoryPages = ${manifest.limits.memoryBytes / 65536}\n`,
);
for (const [name, source] of files) {
  await mkdir(path.dirname(name), { recursive: true });
  await writeFile(name, source);
}
execFileSync(
  "gofmt",
  ["-w", ...[...files.keys()].filter((name) => name.endsWith(".go"))],
  { windowsHide: true },
);
console.log(
  `Generated ${files.size} binding files from ${entries.length} Rust payloads`,
);
