# traq-markdown-engine

Monorepo for the traQ Markdown parser packages:

- `@traq-markdown-parser/core`
- `@traq-markdown-parser/commonmark`
- `@traq-markdown-parser/trap-extension`
- `@traq-markdown-parser/traq`

The packages retain their existing public npm names and Go module paths.

## Development

Use Bun 1.3.14+, Go 1.26+, and rustup. The root `rust-toolchain.toml` pins Rust
and the Wasm target. Windows also requires the MSVC C++ build tools. Install
the root tooling and workspace dependencies:

```sh
bun install
```

The root commands operate on all four packages in dependency order:

```sh
bun run format        # apply Prettier, rustfmt, and gofmt
bun run format:check  # verify formatting without modifying files
bun run lint:check    # run ESLint without modifying files
bun run build         # build all TypeScript packages and the traQ Wasm package
bun run typecheck     # type-check every TypeScript package
bun run test          # run TypeScript, Rust, and Go tests
bun run check         # run the complete local CI suite
```

All build, code generation, checks, formatting, and corpus tools live in the
root `scripts/` directory. Package commands delegate to these shared tools.
Rust crates share one root Cargo workspace and lockfile; dependencies between
packages resolve locally. Go modules are connected by the root `go.work`.

Run `bun run build` before individual Wasm or Go tests. `bun run check` builds
the required artifacts and runs the CI suite. See [traQ development](packages/traq/CONTRIBUTING.md)
for ownership, generated contracts, consumer verification, and examples.

TypeScript, JavaScript, JSON, Markdown, YAML, and styles use the Prettier rules
from traQ S-UI. Rust and Go use their standard formatters, `cargo fmt` and
`gofmt`.
