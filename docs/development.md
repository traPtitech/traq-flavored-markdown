# Development guide

This guide covers local setup, builds, generated artifacts, and workspace
layout.

## Prerequisites

Install Node 26 with npm 12.2.1, Bun 1.4.3 or later, Go 1.27.3 or later, and
rustup. `rust-toolchain.toml` pins the Rust toolchain and Wasm target. On
Windows, install the MSVC C++ build tools; neither WSL nor Bash is required.

From the repository root, install dependencies and prepare all artifacts:

```sh
bun install --frozen-lockfile
bun run build
```

## Commit hooks

This repository uses [Husky](https://typicode.github.io/husky/) and
[lint-staged](https://github.com/lint-staged/lint-staged) to format and lint
staged TypeScript, JavaScript, and documentation files before each commit.

After installing dependencies, initialize the hook once:

```sh
bun run husky:prepare
```

After that, commit as usual.

## Common commands

| Command                               | Purpose                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `bun run format`                      | Apply Prettier, rustfmt, and gofmt                              |
| `bun run format:check`                | Check formatting without changing files                         |
| `bun run lint:check`                  | Run ESLint without changing files                               |
| `bun run build`                       | Generate bindings and build TypeScript, Wasm, and CSS           |
| `bun run build:typescript`            | Build TypeScript from checked-in bindings without Cargo or Wasm |
| `bun run test:unit`                   | Run pure TypeScript and contract unit tests                     |
| `bun run typecheck`                   | Type-check all TypeScript packages                              |
| `bun run test`                        | Run TypeScript, Rust, and Go tests                              |
| `bun run check`                       | Run the complete local CI suite                                 |
| `bun run --cwd packages/sdk examples` | Run all public API examples                                     |

Root commands operate on every public package. Package commands, such as
`bun run --cwd packages/sdk test`, are useful during iteration after the root
build has prepared their dependency outputs. Build before running individual Wasm
or Go tests.

## Build and generated artifacts

Rust is the source of truth for payload types, validation, presets, and
processing contracts. TypeScript bindings are authored in TypeScript; emitted
JavaScript and declaration files are build outputs. Do not hand-edit generated
TypeScript or Go sources.

The root build pipeline:

1. Exports Rust contracts and generates bindings for every plugin and the SDK.
2. Compiles TypeScript packages in dependency order.
3. Builds the traQ Wasm artifact, JavaScript, declarations, and CSS, then writes
   `packages/sdk/dist/contract.json` with the artifact digest.

Generated sources are kept in each owner's `typescript/generated` and
`go/generated_*.go` directories. Intermediate Rust contracts are under `target/`;
distributable outputs are in each package's `dist/` directory. Changes to Rust
inputs, including their paths, can change source provenance. Three identities
serve separate purposes: `contractId` hashes the normalized semantic contract,
`sourceFingerprint` identifies the Rust build inputs, and SHA-256 identifies
the exact Wasm bytes. Runtime compatibility uses `contractId`; distribution
checks also verify source provenance and artifact bytes.

Generators return an `OutputManifest` containing each owner, repository-relative
path, and source text. One writer formats outputs before replacement and records
managed paths in `.generated-outputs.json`. Replacing an owner's outputs removes
only its retired managed files; unrelated files are preserved. The generated
check emits into an isolated directory and compares the complete output sets
without writing to the checkout. Build tasks share this contract prerequisite
and visit each dependency once.

Use the following commands when working on contracts or generated bindings:

```sh
bun run generate:bindings
bun run scripts/generate-bindings.ts commonmark-plugin
bun run scripts/generate-bindings.ts extensions-plugin
bun run scripts/generate-bindings.ts traq-plugin
bun run scripts/generate-bindings.ts sdk
bun run check:generated
bun run build:corpus
```

After changing a Rust contract, run `bun run build`, review the generated diff,
then run `bun run check`. The SDK build runs the same dependency task graph as
the root build, including its plugin prerequisites.

## Workspace layout and dependencies

Rust crates share the root Cargo workspace and lockfile. Root
`workspace.dependencies` declares cross-package paths; crates inside one package
may use relative paths. No sibling checkout or local Cargo patch is needed.

The root `go.work` connects local Go modules and owns version-specific local
replacements for internal dependencies. Published `go.mod` files retain matching
version requirements without local replacements. `go mod tidy` operates on one
module rather than the workspace graph, so use workspace tests and `go list -m
all` to verify local resolution. Go module paths follow the repository layout,
including the CommonMark, generic extensions, and traQ plugin directories.

`scripts/workspace/descriptor.ts` explicitly declares package owners and allowed
owner dependencies. npm manifests and Go module files provide the actual build
graphs; Cargo metadata provides crate edges. Architecture checks compare those
edges with the owner policy and explicit crate restrictions, so changing a
package's dependencies cannot silently change its architectural permissions.

`tsconfig.build.base.json` defines shared TypeScript emit options. Each package
owns its source and output selection; `tsconfig.base.json` provides tooling
type-check options. The corpus has its own configuration, and `scripts/tsc.ts`
resolves the selected compiler independently of package depth.

After dependency changes, rebuild and inspect generated contract diffs. Corpus
dependencies stay in `tools/corpus`; shared formatters, linters, and compiler
tools stay at the repository root.

The `@typescript/native` alias selects the latest stable TypeScript 7 compiler.
The `typescript` alias uses Microsoft's `@typescript/typescript6` compatibility
package because typescript-eslint still requires the TypeScript 6 JavaScript
API. Both builds and package-consumer checks use the native compiler.

The root ESLint override makes the React plugin's older peer range use the
same ESLint version as the rest of the workspace. Run the full lint and test
suite before changing this override. Bun keeps its seven-day release-age gate
for other packages; the exceptions in `bunfig.toml` allow the reviewed, pinned
updates, including the markdown-it security fix and vite-plugin-singlefile's
removal of the vulnerable braces dependency.

`vendor/mdurl` retains the latest upstream parser and its tests, with an idna
dependency update for RUSTSEC-2024-0421. The Cargo patch preserves permissive
Markdown URL parsing while removing the vulnerable idna 0.3 dependency. The
SDK source fingerprint includes the vendored sources and manifest.
