import { execFileSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = path.resolve(root, process.env.CARGO_TARGET_DIR || "target");
const contracts = path.join(target, "node-contracts");
const run = (command, args) =>
  execFileSync(command, args, {
    cwd: root,
    env: { ...process.env, CARGO_TARGET_DIR: target },
    stdio: "inherit",
    windowsHide: true,
  });

run("cargo", [
  "build",
  "--locked",
  "--release",
  "--target",
  "wasm32-unknown-unknown",
  "-p",
  "traq-markdown-wasm",
]);

run("cargo", [
  "run",
  "--locked",
  "--release",
  "-p",
  "traq-markdown-wasm",
  "--features",
  "contracts",
  "--bin",
  "export-node-contracts",
  "--",
  contracts,
]);

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist"), { recursive: true });
await copyFile(
  path.join(target, "wasm32-unknown-unknown/release/traq_markdown_wasm.wasm"),
  path.join(root, "dist/parser.wasm"),
);
run(process.execPath, ["scripts/generate-bindings.mjs", contracts]);

run(process.execPath, [
  "node_modules/typescript/bin/tsc",
  "-p",
  "typescript/tsconfig.build.json",
]);
run(process.execPath, ["scripts/contract.mjs"]);

run(process.execPath, [
  "node_modules/sass/sass.js",
  "--no-source-map",
  "styles/index.scss",
  "dist/index.css",
]);
