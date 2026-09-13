# Development

Use Bun 1.3.14+, Go 1.26+, and rustup. The Rust toolchain and Wasm target are pinned
in `rust-toolchain.toml`. Windows additionally needs the MSVC C++ build tools;
WSL and Bash are not required.

Run shared commands from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun run --cwd packages/traq examples
```

## Ownership

| Location                                       | Responsibility                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/core`                                | Grammar-independent AST, declarations, parsing, rendering, extraction and codec |
| `packages/plugins/commonmark`                  | CommonMark and generic extension contracts, syntax and rendering                |
| `packages/plugins/trap`                        | traP extension contracts, syntax, rendering and extraction                      |
| `packages/traq/crates/grammar`                 | Published grammar presets and their catalog                                     |
| `packages/traq/crates/processing`              | traQ notification, message and extraction policies                              |
| `packages/traq/crates/wasm`                    | Wasm ABI and exported contracts                                                 |
| `packages/traq/typescript`, `packages/traq/go` | traQ SDK, preset and artifact selection                                         |
| `packages/traq/styles`                         | traQ presentation CSS                                                           |
| `packages/traq/scripts`                        | traQ artifact build and distribution-specific code generation                   |
| `scripts/codegen`                              | Shared Go and TypeScript contract generation, with its tests                    |
| `scripts/checks`                               | Repository dependency boundaries, generated sources and packaged consumers      |
| `tools/corpus`                                 | Corpus collection/comparison CLI, viewer, dependencies and tests                |
| `tests/fixtures`                               | Shared CommonMark specification data and attribution                            |
| `packages/traq/tests/fixtures`                 | Frozen traQ compatibility expectations shared across languages                  |

Keep component code with its owner, grouped into `crates`, `typescript` and `go`.
Core does not depend on plugins or traQ. Plugins may depend on core; the traP
syntax also uses CommonMark syntax. traQ composes these parts and owns application
policy. Parser, renderer and extractor share a native AST without depending on
the codec or Wasm distribution.

A script that knows traQ presets or artifact metadata belongs to traQ. Shared
code generators belong to `scripts/codegen`; root entry points coordinate them.
Keep generator tests beside the generator. Package README files describe their
APIs and responsibilities; this file owns common development instructions.

## Generation and build

Rust is the source of truth for payload types, validation, presets and processing
contracts. Bindings are authored in TypeScript; JavaScript and declarations are
build outputs. Do not hand-edit generated TypeScript or Go files.

The root `build` command runs the following pipeline:

1. Export Rust contracts and generate **all** plugin and traQ bindings.
2. Compile TypeScript packages in dependency order.
3. Build and package the traQ Wasm, JavaScript, declarations and CSS, then write
   `packages/traq/dist/contract.json` with the artifact digest.

Generated sources remain in each owner's `typescript/generated` and
`go/generated_*.go`. Intermediate Rust contracts are under `target/`; distributable
outputs are under each package's `dist/`. Source changes, including path changes
in the Rust inputs, can change the Wasm build ID. Rebuild and distribute the SDK
and Wasm together; runtime initialization rejects mismatched IDs.

```sh
bun run generate:bindings             # update generated sources explicitly
bun run build                         # generate and build the four packages
bun run check:generated               # regenerate and reject changed sources
bun run build:corpus                  # build the standalone report viewer
```

The full `check` command compares generated sources before and after generation
within its build stage, then compiles and tests those same sources. It performs
generation once. This checks reproducibility against the working files, including
added or removed outputs, and does not require a clean Git index. After editing
Rust contracts, run `build`, review the generated diff, then run `check`.

Individual package `build` and `typecheck` commands are for iteration after the
root build has prepared dependency outputs. traQ's individual build regenerates
its own bindings. Use the root build after changing plugin contracts.

## Verification

`bun run check` runs formatting, lint, dependency boundaries, binding freshness,
all package and corpus builds, type checking, TypeScript/Rust/Go tests, Clippy and
packed consumer verification. CI runs this command on Ubuntu and Windows.

`check:package` packs all four distributable packages into a fresh temporary
consumer and checks public declarations, AST parsing, HTML, CSS and the Wasm
digest. Temporary files and archives are removed afterwards. API examples are
available through `bun run --cwd packages/traq examples`.

Go tests execute the built Wasm. Build first when invoking them separately; use
`-count=1` when the Wasm artifact changes to avoid stale test-cache results.
Changes to Go concurrency also require
`go -C packages/traq/go test -race ./...` with a supported C compiler installed.

`packages/traq/crates/processing` borrows native ASTs. Its normal dependencies must
not include `markdown-codec`. Native Rust and Go/Wasm exercise 787 frozen
notification expectations. TypeScript/Wasm covers extraction, and TypeScript
covers HTML rendering. Packed consumers and examples exercise public processing
APIs.

## Dependencies and module paths

All Rust crates use the root Cargo workspace and lockfile. Root
`workspace.dependencies` declares cross-package paths; crates within a package may
use relative paths. No sibling checkouts or machine-local Cargo patches are needed.

The root `go.work` connects the local Go modules and owns version-specific local
replacements for their unpublished dependency versions. This keeps workspace
resolution offline without repeating replacements in every module. `go mod tidy`
works on an individual module rather than this workspace graph, so use workspace
tests and `go list -m all` to verify local resolution during development.
Their module paths match the
repository layout, including `packages/plugins/commonmark/go` and
`packages/plugins/trap/go`. Update external Go consumers to those paths when
migrating from the previous flat layout. npm names remain unchanged, including
`@traq-markdown-parser/trap-extension`.

`tsconfig.build.base.json` holds shared TypeScript emit options. Packages own their
source/output selections. `tsconfig.base.json` holds tooling type-check options;
the corpus has its own configuration. `scripts/tsc.ts` resolves the selected
compiler independently of package directory depth. The older `typescript`
dependency checks published declarations against the consumer compiler.

After dependency changes, rebuild and inspect generated contract diffs. The
corpus owns its viewer dependencies and comparison-specific libraries; shared
formatting, linting and compiler tools stay at the root.

## Fixtures and corpus

The unmodified CommonMark specification data has one copy in
[tests/fixtures](tests/fixtures/README.md). traQ's frozen AST and notification
expectations are in [its fixture directory](packages/traq/tests/fixtures/README.md).
Do not regenerate compatibility expectations from the parser under test. Preserve
source, provenance, attribution and the accepted meaning of existing grammar IDs.

Fixtures contain no production messages or credentials. Private corpus data stays
in ignored `.private` directories. Collection, comparison, synthetic sample inputs
and self-contained reports are documented by the
[corpus tool](tools/corpus/README.md).
