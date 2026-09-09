import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const { values: v } = parseArgs({
  options: {
    corpus: { type: "string" },
    out: { type: "string" },
    traq: {
      type: "string",
      default: path.resolve(root, "../../traPtitech/traQ"),
    },
    sui: {
      type: "string",
      default: path.resolve(root, "../../traPtitech/traQ_S-UI"),
    },
    "traq-ref": { type: "string", default: "origin/master" },
    "sui-ref": { type: "string", default: "origin/master" },
    origin: { type: "string", default: "https://q.trap.jp" },
    max: { type: "string", default: "100000" },
    format: { type: "string", default: "both" },
  },
});
if (!v.corpus) throw Error("--corpus messages.jsonl is required");
if (!Number.isSafeInteger(Number(v.max)) || Number(v.max) <= 0)
  throw Error("--max must be a positive integer");
const corpus = path.resolve(v.corpus),
  out = path.resolve(v.out ?? path.join(root, ".private/corpora/comparison"));
const baseline = path.join(root, ".private/corpus-baseline");
await mkdir(baseline, { recursive: true });
await mkdir(out, { recursive: true });
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", windowsHide: true });
const git = (repo, args) =>
  execFileSync("git", ["-C", path.resolve(repo), ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
const show = (repo, ref, file) => git(repo, ["show", ref + ":" + file]) + "\n";
const versions = {
  suiMaster: git(v.sui, ["rev-parse", v["sui-ref"]]),
  traqMaster: git(v.traq, ["rev-parse", v["traq-ref"]]),
  renderer: git(root, ["rev-parse", "HEAD"]),
  processor: git(root, ["rev-parse", "HEAD"]),
};
const lock = JSON.parse(show(v.sui, v["sui-ref"], "package-lock.json"));
const rendererVersion =
  lock.packages["node_modules/@traptitech/traq-markdown-it"].version;
const { createRequire } = await import("node:module");
const currentRequire = createRequire(
  path.resolve(root, "../commonmark/package.json"),
);
const katexVersion = currentRequire("katex").version;
const highlightVersion = currentRequire("highlight.js").versionString;
const baselinePackage = {
  private: true,
  type: "module",
  dependencies: {
    "@traptitech/traq-markdown-it": rendererVersion,
    katex: katexVersion,
    "highlight.js": highlightVersion,
  },
  overrides: { katex: katexVersion, "highlight.js": highlightVersion },
};
await writeFile(
  path.join(baseline, "package.json"),
  JSON.stringify(baselinePackage, null, 2),
);
if (!process.env.npm_execpath)
  throw Error("Run this command through npm run corpus:compare");
run(
  process.execPath,
  [
    process.env.npm_execpath,
    "install",
    "--prefer-offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  baseline,
);
const baselineRequire = createRequire(path.join(baseline, "package.json"));
const legacyRequire = createRequire(
  baselineRequire.resolve("@traptitech/traq-markdown-it"),
);
const katexBefore = legacyRequire("katex").version;
const highlightBefore = legacyRequire("highlight.js").versionString;
if (katexBefore !== katexVersion || highlightBefore !== highlightVersion)
  throw Error("Comparison requires matching KaTeX and highlight.js versions");
Object.assign(versions, {
  katexBefore,
  highlightBefore,
  highlightAfter: highlightVersion,
  katexAfter: katexVersion,
  baselineRenderer: rendererVersion,
});
await writeFile(
  path.join(out, "revisions.json"),
  JSON.stringify(versions, null, 2),
);
const goRoot = path.join(baseline, "notification");
await mkdir(path.join(goRoot, "go-before"), { recursive: true });
for (const name of ["parser.go", "spoiler.go"])
  await writeFile(
    path.join(goRoot, "go-before", name),
    show(v.traq, v["traq-ref"], "utils/message/" + name),
  );
await copyFile(
  new URL("./notification/main.go", import.meta.url),
  path.join(goRoot, "main.go"),
);
const goMod = show(v.traq, v["traq-ref"], "go.mod");
const version = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = goMod.match(new RegExp("\\s" + escaped + "\\s+(\\S+)"));
  if (!match) throw Error("Missing baseline dependency " + name);
  return match[1];
};
await writeFile(
  path.join(goRoot, "go.mod"),
  `module corpuscomparison\n\ngo 1.26.0\n\nrequire (\n github.com/gofrs/uuid ${version("github.com/gofrs/uuid")}\n github.com/json-iterator/go ${version("github.com/json-iterator/go")}\n github.com/traq-markdown-parser/traq/go v0.1.0\n)\nreplace github.com/traq-markdown-parser/traq/go => ${JSON.stringify(path.join(root, "go").replaceAll("\\", "/"))}\n`,
);
await writeFile(
  path.join(goRoot, "config.json"),
  JSON.stringify({
    origin: v.origin,
    wasm: path.join(root, "dist/parser.wasm"),
  }),
);
run("go", ["mod", "tidy"], goRoot);
run(process.execPath, [
  fileURLToPath(new URL("./compare-frontend.mjs", import.meta.url)),
  "--corpus",
  corpus,
  "--out",
  out,
  "--max",
  v.max,
  "--baseline",
  baseline,
  "--origin",
  v.origin,
]);
run(
  "go",
  [
    "run",
    ".",
    "-corpus",
    corpus,
    "-out",
    out,
    "-max",
    v.max,
    "-config",
    path.join(goRoot, "config.json"),
  ],
  goRoot,
);
run(process.execPath, [
  fileURLToPath(new URL("./report.mjs", import.meta.url)),
  "--data",
  out,
  "--out",
  out,
  "--format",
  v.format,
]);
console.log(
  JSON.stringify({ out, messagesLimit: Number(v.max), format: v.format }),
);
