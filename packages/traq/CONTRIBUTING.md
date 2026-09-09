# Development

## Setup and verification

Use Bun 1.3.14+, Go 1.26+, and rustup. The Rust toolchain and Wasm target are pinned in the root `rust-toolchain.toml`. Windows additionally needs the MSVC C++ build tools; WSL and Bash are not required.

Run commands from the monorepo root. One install prepares all four packages:

```sh
bun install --frozen-lockfile
bun run check
bun run --cwd packages/traq examples
```

`check` verifies formatting, lint, builds, TypeScript types, TypeScript/Rust/Go tests,
architecture, packaged consumers, and generated sources. Use the individual root
commands from [README](../../README.md) while iterating.

`build` compiles Wasm, exports Rust contracts to `target/node-contracts`, generates TypeScript and Go sources, compiles TypeScript into JavaScript and declarations with `tsc`, and writes the artifact digest to `dist/contract.json`.

`check:package` packs all four distributable packages into a fresh temporary consumer and checks public declarations, AST parsing, HTML, CSS, and the Wasm digest. The temporary directory and archives are removed afterwards.

Go tests execute the built Wasm. Build first when invoking tests separately; use `-count=1` when the Wasm artifact changes to avoid stale test-cache results. Changes to Go concurrency also require `go -C packages/traq/go test -race ./...` with a supported C compiler installed.

## Ownership

Paths below are relative to `packages/traq` unless noted otherwise.

| Location                                    | Responsibility                                                      |
| ------------------------------------------- | ------------------------------------------------------------------- |
| crates/grammar                              | traQ grammar presets and the distribution catalog                   |
| crates/processing                           | traQ notification and extraction presets                            |
| crates/wasm                                 | Wasm ABI, distribution catalog, registered node contract list       |
| `typescript/index.ts`                       | TypeScript Wasm transport and lifecycle                             |
| `go/parser.go`                              | traQ preset and artifact selection over core Go runtime             |
| core Go module                              | Shared AST decoding and Wasm runtime                                |
| commonmark / trap-extension Go modules      | Generated payloads and factories owned by each extension            |
| `typescript/generated`, `go/generated_*.go` | Owner composition, presets, processing output and artifact metadata |
| Root `scripts/codegen`                      | Shared code generation and distribution composition                 |
| `tests/fixtures`                            | Public cross-language and distribution compatibility fixtures       |
| `examples/{rust,go,typescript}`             | Public API consumers                                                |

Bindings are authored in `.ts`; `.js` and `.d.ts` are build outputs. Rust is the source of truth for generated payload types and validators. Do not hand-edit generated files. HTML implementations belong to their core / CommonMark / traP owners; traQ composes them and owns its presentation CSS.

## Updating dependencies

All Rust crates belong to the root Cargo workspace. Intra-repository dependencies
use local paths declared in the root manifest; external versions are recorded in
the root `Cargo.lock`. Update dependencies there, rebuild, and inspect the generated
contract diff. No sibling checkouts or machine-local Cargo patches are needed.
Parser initialization rejects a Rust build ID that does not match its generated SDK.

Fixtures contain no production messages or credentials. Their provenance and update policy are documented in [tests/fixtures](tests/fixtures/README.md).

`crates/processing` owns the distribution's AST consumers and their presets. Processing contract types are exported alongside AST contracts, including referenced objects and arrays. Its normal dependency tree must not include `markdown-codec`; notification rendering and extraction borrow the native AST. The notification corpus has 787 frozen expectations, exercised by native Rust and Go/Wasm. TypeScript/Wasm tests cover AST extraction and TypeScript tests cover HTML rendering. Package consumers and all three examples also exercise the processing API.
