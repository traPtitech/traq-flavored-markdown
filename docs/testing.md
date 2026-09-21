# Testing and compatibility

Run `bun run check` before submitting a broad change. CI splits its checks
across jobs. TypeScript, corpus, architecture, and package checks run on Ubuntu
and Windows; the remaining checks run on Ubuntu.

## Choose the smallest useful check

| Change                     | Check                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| Formatting-only change     | `bun run format:check`                                               |
| TypeScript implementation  | `bun run typecheck` and the relevant package test command            |
| Rust contracts or grammar  | `bun run build`, review generated files, then `bun run check`        |
| Go or Wasm behavior        | Build first, then run the affected Go tests                          |
| Go concurrency             | `go -C packages/sdk/go test -race ./...` with a supported C compiler |
| Published API or packaging | `bun run check:package`                                              |
| Parser compatibility       | Fixture tests and, where appropriate, corpus comparison              |

`check:package` packs all four public packages into a temporary consumer and
verifies public declarations, AST parsing, HTML, CSS, and the Wasm digest. It
removes temporary files and archives after the run.

Go tests execute the built Wasm. If the artifact changes, use `-count=1` for an
individual Go test invocation to avoid stale cache results.

## Generated sources

`bun run check:generated` regenerates bindings and rejects a changed working
tree. The full check already performs the equivalent reproducibility check as
part of its single build stage. Generated TypeScript and Go files are committed
outputs: review their diffs, but do not edit them by hand.

## Fixtures and corpus

The unmodified CommonMark specification data has one copy in
[tests/fixtures](../tests/fixtures/README.md). Frozen traQ AST and plain-text
expectations live in [packages/sdk/tests/fixtures](../packages/sdk/tests/fixtures/README.md).
Do not regenerate compatibility expectations from the parser under test. Keep
their source, provenance, attribution, and the accepted meaning of existing
grammar IDs intact.

Fixtures contain no production messages or credentials. Private corpus data
belongs in ignored `.private` directories. The [corpus tool](../tools/corpus/README.md)
documents collection, comparison, synthetic samples, and its self-contained
report. Native Rust and Go/Wasm run the frozen plain-text corpus;
TypeScript/Wasm covers extraction, and TypeScript covers HTML rendering.
