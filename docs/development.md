# Development guide

This guide covers local setup, builds, generated artifacts, and workspace
layout. Read [CONTRIBUTING](../CONTRIBUTING.md) first for contribution policy and
the required checks for a change.

## Prerequisites

Install Node 24 with npm 11.17.0, Bun 1.3.14 or later, Go 1.26 or later, and
rustup. `rust-toolchain.toml` pins the Rust toolchain and Wasm target. On
Windows, install the MSVC C++ build tools; neither WSL nor Bash is required.

From the repository root, install dependencies and prepare all artifacts:

```sh
bun install --frozen-lockfile
bun run build
```

## Common commands

| Command                               | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `bun run format`                      | Apply Prettier, rustfmt, and gofmt                    |
| `bun run format:check`                | Check formatting without changing files               |
| `bun run lint:check`                  | Run ESLint without changing files                     |
| `bun run build`                       | Generate bindings and build TypeScript, Wasm, and CSS |
| `bun run typecheck`                   | Type-check all TypeScript packages                    |
| `bun run test`                        | Run TypeScript, Rust, and Go tests                    |
| `bun run check`                       | Run the complete local CI suite                       |
| `bun run --cwd packages/sdk examples` | Run all public API examples                           |

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
inputs, including their paths, can change the Wasm build ID. Always distribute
the SDK and Wasm built from the same source and locked dependencies.

Use the following commands when working on contracts or generated bindings:

```sh
bun run generate:bindings
bun run scripts/generate-bindings.ts commonmark-plugin
bun run scripts/generate-bindings.ts traq-plugin
bun run scripts/generate-bindings.ts sdk
bun run check:generated
bun run build:corpus
```

After changing a Rust contract, run `bun run build`, review the generated diff,
then run `bun run check`. The complete check verifies generated sources before
and after its build stage, including added and removed files, without requiring a
clean Git index. The SDK's individual build regenerates only its own bindings;
use the root build after changing plugin contracts.

## Workspace layout and dependencies

The architecture and ownership map are documented in
[architecture.md](architecture.md). Rust crates share the root Cargo workspace
and lockfile. Root `workspace.dependencies` declares cross-package paths; crates
inside one package may use relative paths. No sibling checkout or local Cargo
patch is needed.

The root `go.work` connects local Go modules and owns version-specific
replacements for unpublished dependencies. It keeps workspace resolution offline
without copying replacements into each module. `go mod tidy` operates on one
module rather than the workspace graph, so use workspace tests and `go list -m
all` to verify local resolution. Go module paths follow the repository layout,
including `packages/plugins/commonmark/go` and `packages/plugins/traq/go`.

`tsconfig.build.base.json` defines shared TypeScript emit options. Each package
owns its source and output selection; `tsconfig.base.json` provides tooling
type-check options. The corpus has its own configuration, and `scripts/tsc.ts`
resolves the selected compiler independently of package depth.

After dependency changes, rebuild and inspect generated contract diffs. Corpus
dependencies stay in `tools/corpus`; shared formatters, linters, and compiler
tools stay at the repository root.
