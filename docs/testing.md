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
| Go module distribution     | `bun run check:go-consumer` after building the SDK                   |
| Go concurrency             | `go -C packages/sdk/go test -race ./...` with a supported C compiler |
| Published API or packaging | `bun run check:package`                                              |
| Parser compatibility       | Fixture tests and, where appropriate, corpus comparison              |

`check:package` packs all five public packages into a temporary consumer and
verifies public declarations, AST parsing, HTML, CSS, and the Wasm digest. It
removes temporary files and archives after the run.

Go tests execute the built Wasm. If the artifact changes, use `-count=1` for an
individual Go test invocation to avoid stale cache results.
`check:go-consumer` creates a temporary module outside the repository with
`GOWORK=off`, loads the Go SDK and its bundled Wasm, and parses a message. It
uses local replacements only in that temporary consumer; the published modules
have no replacements. The release workflow repeats the check against the pushed
Go tags without local replacements.

## Generated sources

`bun run check:generated` generates into an isolated directory and compares all
managed output paths and contents with the checkout. The full check performs
the same check and compares the tracked Go Wasm's source fingerprint, semantic
contract, and ABI with the newly built SDK artifact. Generated TypeScript and Go files, including
`packages/sdk/go/parser.wasm`, are committed outputs: review their diffs, but do
not edit them by hand.

## Resource-specific suites

`bun run test:typescript` executes the following suites serially. Each can also
be selected directly while iterating; the suite classifier is in
`scripts/testing/suites.ts`. Its include/exclude globs declare each suite's
resources explicitly. Every discovered test must match exactly one suite;
unclassified or overlapping files fail before any test runs. Place new tests in
the appropriate resource directory or update that declaration when introducing
a new compiler or workspace test.

| Command                  | Required resources                                                              |
| ------------------------ | ------------------------------------------------------------------------------- |
| `bun run test:unit`      | Built TypeScript and local fixtures; no Wasm or Go compiler                     |
| `bun run test:assembly`  | Exported contracts, built packages, and Sass                                    |
| `bun run test:codegen`   | Go compiler for temporary generated modules                                     |
| `bun run test:workspace` | Go module commands and temporary workspaces                                     |
| `bun run test:wasm`      | Fresh SDK Wasm and built SDK                                                    |
| `bun run test:corpus`    | Synthetic streams and injected adapters; no credentials or application checkout |

For the shortest independent loop, run `bun run build:typescript` and then
`bun run test:unit`. CI runs that loop in a separate job that does not install
Rust or Go. Compiler, workspace, and Wasm suites have explicit process budgets
and are not mixed into the pure runner.

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
