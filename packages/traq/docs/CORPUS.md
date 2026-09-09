# Corpus comparison

Run these commands from the `traq` repository after building the four sibling packages with Node.js 24+, Rust, and Go installed. The comparison installs the old renderer at the version locked by S-UI and builds the old Go parser from the selected traQ commit. The defaults use `../../traPtitech/traQ` and `../../traPtitech/traQ_S-UI`; override these paths when your checkouts are elsewhere.

```sh
npm run corpus:collect -- --env-file /absolute/path/to/credentials.env --out .private/corpora/sample --max-messages 100000
npm run corpus:compare -- --corpus .private/corpora/sample/messages.jsonl --traq /path/to/traQ --sui /path/to/traQ_S-UI --origin https://q.trap.jp
npm run corpus:report -- --data .private/corpora/comparison --format both
npm run test:corpus
```

The credential file contains `TRAQ_API_BASE_URL` and `BOT_ACCESS_TOKEN`. Alternatively pass `--base-url` and `--token-file`; the latter is a file containing only the token. Collection only makes GET requests, samples public channels in deterministic channel order, and defaults to at most 100,000 messages and 2,000 messages per channel. `--until`, `--max-channels`, `--channel-offset`, and `--per-channel` control sampling. An existing `messages.jsonl` is never overwritten.

Each UTF-8 JSONL row has a `source` string containing the original message. Collection also writes pseudonymous `id` and `channel` fields and a manifest. Message contents remain private data: output stays under the ignored `.private/corpora/` directory, and logs omit message bodies and credentials. Existing JSONL corpora with a `source` field can be compared without collection.

Comparison defaults to 100,000 messages and the local `origin/master` refs of both application checkouts. Fetch those refs first if needed. Use `--max`, `--traq-ref`, `--sui-ref`, and `--out` to change them. Both renderers use the same deterministic store, KaTeX version, and highlight.js version to avoid store data and presentation dependency versions obscuring parser differences. The baseline pins both libraries to the versions installed in the current renderer. Comparison verifies the resolved versions before processing messages and records them with the selected revisions.

The result directory contains raw JSONL differences for full rendering, inline rendering, notifications, and embeddings, plus summaries and two self-contained reports:

- `differences.html`: searchable, paginated rich rendering, raw HTML diff, whitespace-only difference filter, and timing statistics.
- `differences.mhtml`: all rendering and notification differences in one static rich document, with embedded CSS and math fonts. Open with a browser supporting MHTML, such as Chrome or Edge. It includes every row, independently of HTML pagination.

External images are shown as placeholders and links are inert. Neither report fetches external message resources. `--format html`, `mhtml`, or `both` selects outputs. Timing measures parsing plus rendering/processing with warmup and alternating order; it excludes corpus I/O and is only a local reference, especially on systems with coarse clocks. A successful comparison reports differences without treating them as test failures; inspect the summaries for parser errors and review behavior changes separately.
