# Testing and compatibility

Run `bun run check` before submitting a broad change. CI splits its checks
across jobs. TypeScript, corpus, architecture, and package checks run on Ubuntu
and Windows; the remaining checks run on Ubuntu.

`bun run test:rust` first builds each workspace library independently with every
combination of its declared features, then runs the workspace tests and doctests
with all features. Independent builds catch missing dependency-feature
propagation that workspace feature unification can otherwise hide.

`bun run lint:rust` runs Clippy for all workspace targets and features. Its Node
runner sets `CARGO_BUILD_WARNINGS=deny`, enforcing warning-free CI with Cargo
1.97+ without changing compiler flags or invalidating build caches. CI uses the
same runner.

Every Rust crate inherits the selected lint policy from `workspace.lints` in
the root `Cargo.toml`. The policy favors named module files, explicit lifetimes
in type paths, documented lint exceptions, checked use of self-returning APIs,
and `find_map` for the first matching conversion. Keep exceptions as narrow as
their reason permits. Use `expect` when a warning should remain present; use a
reasoned `allow` when a shared file legitimately differs across build targets.

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
| HTML, CSS, or viewer state | `bun run test:browser` after building all packages                   |

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
`tools/workspace/testing/suites.ts`. Its include/exclude globs declare each suite's
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
| `bun run test:corpus:go` | Independent Go worker plus synthetic SDK comparison after building Wasm         |
| `bun run test:browser`   | Built packages and Chromium; DOM, CSS, adapter and viewer interactions          |

For the shortest independent loop, run `bun run build:typescript` and then
`bun run test:unit`. CI runs that loop in a separate job that does not install
Rust or Go. Compiler, workspace, and Wasm suites have explicit process budgets
and are not mixed into the pure runner.

Install Chromium once with `bunx playwright install chromium`. On Windows the
browser runner can also use an installed Edge or Chrome for local development.
CI installs Playwright's Chromium on Ubuntu. Browser fixtures use local synthetic
data and the built package modules; retained failure traces and screenshots live
in the ignored `test-results/` directory. The gallery checks plugin layout,
spoiler visibility, images, stamps, math/highlighting adapters, safe rendering,
and independent editing drafts. The corpus tests exercise query controls,
bootstrap failures, and resource-isolated preview behavior in a real DOM.

## Fixtures and corpus

The unmodified CommonMark specification data has one copy in
[tests/fixtures](../tests/fixtures/README.md). Frozen traQ AST and plain-text
expectations live in [packages/sdk/tests/fixtures](../packages/sdk/tests/fixtures/README.md).
Do not regenerate compatibility expectations from the parser under test. Keep
their source, provenance, and attribution intact. For the unreleased v1 grammar,
review an intentional semantic change against its source and an independent
specification before editing individual expectations; record that review in the
fixture notes. Released grammar IDs retain their accepted meaning.

Fixtures contain no production messages or credentials. Private corpus data
belongs in ignored `.private` directories. The [corpus tool](../tools/corpus/README.md)
documents collection, comparison, synthetic samples, and its self-contained
report. Native Rust and Go/Wasm run the frozen plain-text corpus;
TypeScript/Wasm covers extraction, and TypeScript covers HTML rendering.
