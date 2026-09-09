# traq-markdown-engine

Monorepo for the traQ Markdown parser packages:

- `@traq-markdown-parser/core`
- `@traq-markdown-parser/commonmark`
- `@traq-markdown-parser/trap-extension`
- `@traq-markdown-parser/traq`

The packages retain their existing public npm names and Go module paths.

## Development

Install the root tooling and every package's locked dependencies:

```sh
npm ci
npm run bootstrap
```

The root commands operate on all four packages in dependency order:

```sh
npm run format        # apply Prettier, rustfmt, and gofmt
npm run format:check  # verify formatting without modifying files
npm run build         # build all TypeScript packages and the traQ Wasm package
npm run typecheck     # type-check every TypeScript package
npm run test          # run TypeScript, Rust, and Go tests
npm run check         # run the complete local CI suite
```

Package-specific implementation scripts remain next to the packages that own
them. The root `scripts/` directory is reserved for cross-package tooling.

TypeScript, JavaScript, JSON, Markdown, YAML, and styles use the Prettier rules
from traQ S-UI. Rust and Go use their standard formatters, `cargo fmt` and
`gofmt`.
