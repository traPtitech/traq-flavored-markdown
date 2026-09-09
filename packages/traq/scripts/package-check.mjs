import {
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  rm,
  realpath,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url)),
  npmCli = process.env.npm_execpath;
if (!npmCli) throw Error("Run npm run check:package");
const run = (args, cwd = root) =>
  execFileSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
const npm = (args, cwd) => run([npmCli, ...args], cwd);
const temp = await realpath(tmpdir()),
  dir = await mkdtemp(path.join(temp, "markdown-packages-"));
try {
  const archives = [];
  for (const repo of ["core", "commonmark", "trap-extension", "traq"]) {
    const cwd = path.resolve(root, "..", repo);
    const [packed] = JSON.parse(
      npm(
        ["pack", "--ignore-scripts", "--json", "--pack-destination", dir],
        cwd,
      ),
    );
    archives.push(path.join(dir, packed.filename));
    const files = new Set(packed.files.map((f) => f.path));
    for (const name of [
      "LICENSE",
      "dist/renderer/index.js",
      "dist/renderer/index.d.ts",
    ])
      if (!files.has(name)) throw Error(repo + ": missing " + name);
    for (const name of files)
      if (/^(?:typescript|crates|go|tests|node_modules)\//.test(name))
        throw Error(repo + ": shipped source " + name);
    if (repo !== "traq" && [...files].some((n) => n.endsWith(".wasm")))
      throw Error("Unexpected Wasm in " + repo);
  }
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  npm(
    [
      "install",
      "--prefer-offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...archives,
    ],
    dir,
  );
  const tsc = fileURLToPath(import.meta.resolve("typescript/bin/tsc"));
  for (const [source, name] of [
    ["typescript/tests/package-consumer", "sdk"],
    ["typescript/tests/rendering", "renderer"],
  ]) {
    await copyFile(
      path.join(root, source, "types.ts"),
      path.join(dir, name + ".ts"),
    );
    run(
      [
        tsc,
        "--noEmit",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        name + ".ts",
      ],
      dir,
    );
    await copyFile(
      path.join(
        root,
        source,
        name === "sdk" ? "runtime.mjs" : "package-runtime.mjs",
      ),
      path.join(dir, name + ".mjs"),
    );
    const contract = JSON.parse(
      await readFile(path.join(root, "dist/contract.json")),
    );
    process.stdout.write(run([name + ".mjs", contract.sha256], dir));
  }
  console.log(
    "Four packed packages: SDK, renderer, declarations, CSS and Wasm integration passed",
  );
} finally {
  if (path.dirname(path.resolve(dir)) !== temp)
    throw Error("Invalid temporary path");
  await rm(dir, { recursive: true, force: true });
}
