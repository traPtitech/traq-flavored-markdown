# Examples

Run `bun install --frozen-lockfile` and `bun run build` at the repository root
first.

| Language   | Source                        | Command                                   |
| ---------- | ----------------------------- | ----------------------------------------- |
| Rust       | [main.rs](rust/src/main.rs)   | `bun run --cwd packages/sdk example:rust` |
| Go         | [main.go](go/main.go)         | `bun run --cwd packages/sdk example:go`   |
| TypeScript | [main.ts](typescript/main.ts) | `bun run --cwd packages/sdk example:ts`   |

`bun run --cwd packages/sdk examples` runs all three. They parse with traQ V1
and pass the resulting document to an extractor; the Rust and Go programs also
render plain text. The Go example accepts `-wasm /path/to/parser.wasm`.
