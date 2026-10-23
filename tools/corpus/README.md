# Corpus comparison tool

Run commands from the repository root after `bun install` and `bun run build`.
Use the repository's declared Bun, Rust, and Go toolchains.

```sh
bun run corpus:collect -- --env-file /absolute/path/to/credentials.env --out .private/corpora/sample --max-messages 100000
bun run corpus:compare -- --corpus .private/corpora/sample/messages.jsonl --traq /path/to/traQ --sui /path/to/traQ_S-UI --origin https://q.trap.jp
bun run corpus:report -- --data .private/corpora/comparisons/<run-id>
bun run test:corpus
bun run --cwd tools/corpus test:go
```

The root commands delegate to this private workspace. While developing it, use
`bun run --cwd tools/corpus build`, `test`, or `typecheck`. Relative CLI paths
always resolve from the repository root, including through `--cwd`.
`examples/dummy.jsonl` is a synthetic input; it contains no production messages.

## Collection

Credentials come from an env file containing `TRAQ_API_BASE_URL` and
`BOT_ACCESS_TOKEN`, or from `--base-url` and `--token-file`. The token file
contains only the token. Collection makes GET requests, samples public channels
in deterministic order, and defaults to 100,000 messages with at most 2,000 per
channel. `--until`, `--max-channels`, `--channel-offset`, and `--per-channel`
control sampling. Existing `messages.jsonl` files are never overwritten.

Each UTF-8 JSONL row requires a string `source`. Collection also writes
pseudonymous `id` and `channel` fields and a sampling manifest. Original message
text is private data, even when identifiers are pseudonymous. Collection output
stays inside ignored `.private/corpora/`; logs omit message text and credentials.
Corpora containing only `source` are also accepted. Empty JSONL lines and CRLF
delimiters are handled identically in TypeScript and Go. Missing or null sources
are errors.

## Comparison runs

The fixed comparison covers standard HTML, condensed HTML, and display plain
text. It defaults to 1,000,000 messages, 200 requested warmups, and local
`origin/master` refs in both application checkouts. Fetch these refs before
running if necessary. `--max`, `--warmups`, `--traq-ref`, `--sui-ref`,
`--origin`, and `--out` customize a run.

Every comparison creates a new directory, by default
`.private/corpora/comparisons/<run-id>`. An explicit `--out` must also name a
directory that does not exist. A failed or concurrent run cannot reuse another
run's result files. Baseline dependencies and a snapshot of the Go worker live
in a separate content-addressed cache at `.private/corpus-cache/`.

`run.json` records the run ID, corpus SHA-256, resolved application revisions,
candidate dirty state, actual Wasm and JavaScript digests, SDK contract and source
identities, dependency versions, environment, bounds, and warmups. Both workers
consume this same validated protocol. Results record the actual number of
warmups, including when the corpus is shorter than requested.

The baseline renderer version comes from S-UI's lockfile, and its KaTeX and
highlight.js versions must match the candidate. Reference and stamp lookups are
deterministic. The baseline Go parser comes from the selected traQ revision.
TypeScript and Go measure their own adapters in-process with alternating order;
corpus I/O and result persistence are excluded. Timings remain local reference
measurements, particularly on systems with coarse clocks.

Each output is an outcome containing its kind (`html`, `text`, or `error`) and
value. Error status has a single representation. The whitespace filter cannot
hide failures or changes of output kind. Old report formats are deliberately
rejected.

After both workers succeed and input/artifact identities are rechecked, the tool
writes `complete.json` with the exact digest of every run file. Report generation
requires this manifest and verifies it before reading results. Modified,
incomplete, or mixed-run data cannot silently become a report. Completed run
directories can be moved and reported again.

The directory contains:

- `frontend-differences.jsonl` and `plain-text-differences.jsonl`: typed outcomes.
- `embedding-differences.jsonl`: resource-card differences.
- `frontend-results.json` and `plain-text-results.json`: per-profile counts and timing.
- `run.json` and `complete.json`: provenance and completion.
- `differences.html`: the searchable, paginated, self-contained offline report.

The report embeds compressed data, JavaScript, and CSS. Use a recent browser with
`DecompressionStream`. External images become placeholders and links are inert;
message resources are not fetched. A successful comparison may contain behavior
differences and parser failures: review the per-profile outcome counts as well
as individual rows.

## Ownership and verification

- `cli/` parses arguments and prints structured progress.
- `infrastructure/` owns paths, exclusive JSONL sinks, digests, Git, and Go module
  assembly. Subprocess execution uses the workspace's bounded process service.
- `collection/` owns API access, sampling, and source statistics.
- `protocol/` is the source of truth for source, run, outcome, and report data.
  TypeScript types are inferred from its portable schema. Go structs and its
  embedded validator schema are generated from that same definition.
- `comparison/` separates baseline preparation, immutable run lifecycle, adapter
  integration, and measurement. `comparison/go` is a standalone, dependency-free
  Go module; `go-app/main.go` only connects it to the legacy parser and SDK.
- `report/` filters and aggregates outcomes and assembles a validated report.
- `viewer/` separates bootstrap, repository queries, navigation, components, and
  inert HTML previews.

`bun run test:corpus` runs synthetic TypeScript units with no Go compiler,
credentials, application checkouts, or Vite build. The language-independent
protocol cases and measurement fixture are also consumed by Go tests.

After building the SDK, `bun run --cwd tools/corpus test:go` checks generated
protocol files, tests the standalone Go worker, and executes both real SDK
adapters against synthetic legacy shims through completion and report assembly.
No production service or external application checkout is involved.
Browser tests run through the repository's Playwright suite and exercise actual
decompression, query transitions, and inert previews.

After editing the protocol, run `bun run --cwd tools/corpus generate:protocol`
and review `comparison/go/generated_protocol.go` and `protocol_schema.json`.
Do not edit these generated files directly. `check:protocol` detects stale Go
types and schema. The ordinary corpus unit suite verifies the shared schema
without requiring Go.
