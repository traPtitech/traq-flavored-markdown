# Corpus comparison tool

Run these commands from the monorepo root after `bun install` and `bun run build`, with Bun 1.4.3+, Rust, and Go installed. The comparison installs the old renderer at the version locked by S-UI and builds the old Go parser from the selected traQ commit. Pass the traQ and S-UI checkout paths explicitly with `--traq` and `--sui` when comparing against local applications.

```sh
bun run corpus:collect -- --env-file /absolute/path/to/credentials.env --out .private/corpora/sample --max-messages 100000
bun run corpus:compare -- --corpus .private/corpora/sample/messages.jsonl --traq /path/to/traQ --sui /path/to/traQ_S-UI --origin https://q.trap.jp
bun run corpus:report -- --data .private/corpora/comparison
bun run test:corpus
```

The root commands delegate to this standalone workspace. While developing the
tool, run the same scripts directly with `bun --cwd tools/corpus run build`,
`test`, or `typecheck`. `examples/dummy.jsonl` is a synthetic one-message
input for inspecting the JSONL shape; it is not production corpus data.
Relative file paths in `collect`, `compare`, and `report` are always resolved
from the monorepo root, including when the root command delegates with `--cwd`.

The credential file contains `TRAQ_API_BASE_URL` and `BOT_ACCESS_TOKEN`. Alternatively pass `--base-url` and `--token-file`; the latter is a file containing only the token. Collection only makes GET requests, samples public channels in deterministic channel order, and defaults to at most 100,000 messages and 2,000 messages per channel. `--until`, `--max-channels`, `--channel-offset`, and `--per-channel` control sampling. An existing `messages.jsonl` is never overwritten.

Each UTF-8 JSONL row has a `source` string containing the original message. Collection also writes pseudonymous `id` and `channel` fields and a manifest. Message contents remain private data: output stays under the ignored `.private/corpora/` directory, and logs omit message bodies and credentials. Existing JSONL corpora with a `source` field can be compared without collection.

Comparison defaults to 1,000,000 messages, 200 warmups, and the local `origin/master` refs of both application checkouts. Fetch those refs first if needed. Use `--max`, `--warmups`, `--traq-ref`, `--sui-ref`, and `--out` to change them. Both renderers use equivalent deterministic reference and stamp data, KaTeX version, and highlight.js version to avoid store data and presentation dependency versions obscuring parser differences. The baseline pins both libraries to the versions installed in the current renderer. Comparison verifies the resolved versions before processing messages and records them with the selected revisions.

The result directory contains raw JSONL differences for full rendering, inline rendering, plain-text rendering, and embeddings, plus summaries and one self-contained report:

- `differences.html`: searchable, paginated rich rendering, raw HTML diff, whitespace-only difference filter, and timing statistics. The viewer code, CSS, and comparison data are embedded, so it can be opened directly as an offline file.

External images are shown as placeholders and links are inert. The report does not fetch external message resources. Open it in a recent Chrome or Edge, as the viewer uses browser APIs for compressed embedded data. Timing measures parsing plus rendering/processing with warmup and alternating order; it excludes corpus I/O and is only a local reference, especially on systems with coarse clocks. A successful comparison reports differences without treating them as test failures; inspect the summaries for parser errors and review behavior changes separately.

## Reusing the pipeline

The CLI adapters only parse arguments, open files, and assemble services:

- `collection/client.ts` owns bounded GET retries; `sampling.ts` accepts an API
  port and yields messages in deterministic order; `sink.ts` creates outputs
  exclusively. Credential loading stays in the CLI/collection boundary.
- `comparison/runner.ts` accepts asynchronous source streams, named before/after
  adapters, a clock, and difference/progress sinks. The frontend adapter resolves
  references and stamps without a browser or production store. Initialization,
  warmups, alternating measurement, and file I/O remain separate.
- `shared/comparison.ts` owns the profiles, measurement result, provenance, and
  validated `ComparisonPlan`. The workflow writes this plan to `run.json`; both
  runners consume that file, including its paths, limits, and warmups. Frontend
  and Go measurements use the same per-profile result model in
  `frontend-results.json` and `plain-text-results.json`. `shared/protocol.ts`
  validates source rows and typed JSONL differences.
- `report/aggregate.ts` streams differences into compressed pages and injects
  them into an already-built viewer. Build the viewer with `bun run build:corpus`;
  the public report command performs this artifact prerequisite explicitly.
- `viewer/data/repository.ts` validates loaded chunks and owns bounded caches;
  `useReportQuery` owns cancellation and loading/error states. React components
  receive the repository after bootstrap instead of reading/removing embedded
  data during initialization.

`bun run test:corpus` checks these ports with synthetic inputs and in-memory
adapters. It requires no Vite build, credentials, application checkout, or
production corpus. The offline report embeds its data once; switching filters
or pages reuses the repository cache.
