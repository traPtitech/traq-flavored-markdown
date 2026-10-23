# Development guide

This guide covers local setup, builds, generated artifacts, and workspace
layout.

## Prerequisites

Install the Node version in `.node-version`, Bun from `package.json`'s
`packageManager`, Go and npm from `.github/toolchains.json`, and rustup.
`rust-toolchain.toml` pins Rust, its components, and the Wasm target. CI reads
these same declarations through `.github/actions/setup-toolchains`; run
`node tools/workspace/toolchains.ts` to print them locally. On Windows,
install the MSVC C++ build tools; neither WSL nor Bash is required.

From the repository root, install dependencies and prepare all artifacts:

```sh
bun install --frozen-lockfile
bun run build
bunx playwright install chromium
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
| `bun run test`                        | Run TypeScript, Rust, Go, corpus integration, and browser tests |
| `bun run test:browser`                | Check rendered DOM, CSS, and corpus viewer behavior in Chromium |
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

Generated sources are kept in each owner's `typescript/src/generated` and
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
without writing to the checkout. Each package has its own contract prerequisite.
TypeScript, styles, SDK Wasm, and artifact metadata have separate tasks, and each
dependency is visited once. Selecting `core` never generates the SDK or plugins.

Use the following commands when working on contracts or generated bindings:

```sh
bun run generate:bindings
bun run scripts/generate-bindings.ts core
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
including the CommonMark, extensions, and traQ plugin directories.

`tools/workspace/descriptor.ts` explicitly declares package owners and allowed
owner dependencies. npm manifests and Go module files provide the actual build
graphs; Cargo metadata provides crate edges. Architecture checks compare those
edges with the owner policy and explicit crate restrictions, so changing a
package's dependencies cannot silently change its architectural permissions.

`tsconfig.base.json` defines common language and strictness options.
`tsconfig.portable.json` supplies browser-independent Web platform APIs without
Bun or DOM globals; public package builds inherit it through
`tsconfig.build.base.json`. `tsconfig.browser.json` adds DOM and JSX support,
while `tsconfig.tooling.json` enables Bun for commands and tests. Root typecheck
checks public production sources against their build configuration without
emitting, then checks each package's tests. The corpus separately checks its
browser viewer and all source/test files. `tools/workspace/tsc.ts` resolves the selected
compiler independently of package depth.

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

Bun 1.4.3's age exemptions match package names. Each exception also has an
exact root override so a fresh install cannot select an unreviewed future
version. The installation policy tests keep these overrides synchronized with
the workspace pins and retain script blocking and the default age gate.

Markdown URL handling uses `fluent-uri` for authority parsing and
`percent-encoding` for escaping and label decoding. Parsing only the authority
allows Markdown paths to retain spaces and malformed percent escapes until
they are encoded. Hostname recoding preserves the existing Punycode policy;
unparseable authorities remain literal and are escaped without losing input.
IPv6 authority brackets remain literal while path brackets are escaped.
This replaces the Rust `mdurl` dependency and removes its old
`idna` dependency without maintaining a local copy or an advisory exception.
