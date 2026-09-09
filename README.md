# traq-markdown-engine

Monorepo for the traQ Markdown parser packages:

- `@traq-markdown-parser/core`
- `@traq-markdown-parser/commonmark`
- `@traq-markdown-parser/trap-extension`
- `@traq-markdown-parser/traq`

The packages retain their existing public npm names and Go module paths.

## Development

Install Bun, then install the root tooling and every workspace package's locked
dependencies:

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

Package-specific implementation scripts remain next to the packages that own
them. The root `scripts/` directory is reserved for cross-package tooling.

TypeScript, JavaScript, JSON, Markdown, YAML, and styles use the Prettier rules
from traQ S-UI. Rust and Go use their standard formatters, `cargo fmt` and
`gofmt`.
