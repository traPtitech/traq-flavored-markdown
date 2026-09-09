# Development

## Setup and verification

Use Node.js 24+, Go 1.26+, and rustup. The Rust toolchain and Wasm target are pinned in `rust-toolchain.toml`. Windows additionally needs the MSVC C++ build tools; WSL and Bash are not required.

Keep core, commonmark, trap-extension and traq as sibling checkouts. Build their npm packages in that dependency order before running the traq checks.

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run test:rust
npm run test:go
npm run examples
npm run check:architecture
npm run check:package
cargo fmt --all --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
```

`build` compiles Wasm, exports Rust contracts to `target/node-contracts`, generates TypeScript and Go sources, compiles TypeScript into JavaScript and declarations with `tsc`, and writes the artifact digest to `dist/contract.json`.

`check:package` packs all four npm packages into a fresh temporary consumer and checks public declarations, AST parsing, HTML, CSS, and the Wasm digest. The temporary directory and archives are removed afterwards.

Go tests execute the built Wasm and use `-count=1` to avoid stale test-cache results. Changes to Go concurrency also require `go -C go test -race ./...` with a supported C compiler installed.

## Ownership

| Location | Responsibility |
| --- | --- |
| crates/grammar | traQ grammar presets and the distribution catalog |
| crates/processing | traQ notification and extraction presets |
| crates/wasm | Wasm ABI, distribution catalog, registered node contract list |
| `typescript/index.ts` | TypeScript Wasm transport and lifecycle |
| `go/parser.go` | traQ preset and artifact selection over core Go runtime |
| core Go module | Shared AST decoding and Wasm runtime |
| commonmark / trap-extension Go modules | Generated payloads and factories owned by each extension |
| `typescript/generated`, `go/*_generated.go` | Owner composition, presets, processing output and artifact metadata |
| core `scripts/contracts`; traq `scripts/contracts` | Generic code generation; distribution composition |
| `tests/fixtures` | Public cross-language and distribution compatibility fixtures |
| `examples/{rust,go,typescript}` | Public API consumers |

Bindings are authored in `.ts`; `.js` and `.d.ts` are build outputs. Rust is the source of truth for generated payload types and validators. Do not hand-edit generated files. HTML implementations belong to their core / CommonMark / traP owners; traQ composes them and owns its presentation CSS.

## Updating dependencies

The unpublished Rust crates use Git dependencies with a fixed revision and a package version. `Cargo.lock` is committed. Update all dependencies from one repository to the same revision, then rebuild and inspect the generated contract diff. Parser initialization rejects a Rust build ID that does not match its generated SDK.

For simultaneous local development, keep `core`, `commonmark`, `trap-extension`, and `traq` beside one another. Use a machine-local Cargo patch configuration. Override the entire edited repository so its shared AST and declaration types have one Cargo package identity. For example:

```toml
[patch."https://github.com/traq-markdown-parser/core.git"]
markdown-ast = { path = "/absolute/path/to/core/crates/ast" }
markdown-definitions = { path = "/absolute/path/to/core/crates/definitions" }
markdown-definitions-derive = { path = "/absolute/path/to/core/crates/definitions-derive" }
markdown-parser = { path = "/absolute/path/to/core/crates/parser" }
markdown-renderer = { path = "/absolute/path/to/core/crates/renderer" }
markdown-extractor = { path = "/absolute/path/to/core/crates/extractor" }
markdown-codec = { path = "/absolute/path/to/core/crates/codec" }
```

Pass the file with `cargo --config /absolute/path/to/local.toml ...`; use equivalent absolute Windows paths on Windows. Do not commit local overrides or the resulting lockfile changes. Release verification uses the committed revisions without patches.

Fixtures contain no production messages or credentials. Their provenance and update policy are documented in [tests/fixtures](tests/fixtures/README.md).

`crates/processing` owns the distribution's AST consumers and their presets. Processing contract types are exported alongside AST contracts, including referenced objects and arrays. Its normal dependency tree must not include `markdown-codec`; notification rendering and extraction borrow the native AST. The notification corpus has 787 frozen expectations, exercised by native Rust and Go/Wasm. TypeScript/Wasm tests cover AST extraction and TypeScript tests cover HTML rendering. Package consumers and all three examples also exercise the processing API.
