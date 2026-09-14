# SDK implementation notes

This guide documents the boundary between the native Rust implementation and
the TypeScript and Go SDKs. The SDK README owns public usage examples.

## Ownership and generated contracts

Rust owns grammar composition, parsing, node contracts, and semantic
validation. `crates/grammar/src/bindings/presets.rs` defines the published
preset names, native grammars, and generated TypeScript/Go preset constants.
`crates/wasm/src/node_types.rs` registers the node contracts exposed by Wasm.

The core AST shape is `{ source, children }`; a node is
`{ kind, span, data, children? }`. `kind` is a key generated from the Rust
payload type, and `span` is a UTF-8 byte range in `source`. Consumers should use
the generated names and Go types instead of reproducing those contracts.

TypeScript and Go bindings are generated from Rust. The TypeScript payload guards
only verify a node kind and its payload: they do not validate arbitrary JSON, a
span, or descendants. Unsupported contract shapes or generated-name collisions
fail generation, rather than requiring hand-written host implementations.

The build ID detects mismatched Rust source, lockfile, manifest, or pinned
toolchain inputs. It normalizes line endings and paths, so it remains stable
across build environments. It is not a signature. `dist/contract.json` also
records the actual Wasm SHA-256 for diagnostics.

## Host runtimes

`createRuntime` and `NewRuntime` compile the matching Wasm module once. The
browser-only `loadRuntime` entrypoint fetches the packaged artifact once and
keeps its runtime for the page; it exposes parser and extractor factories but
not runtime disposal. Their parsers, extractors, and Go plain-text renderers
each own an independent instance; use separate instances for parallel work.
TypeScript parsing is synchronous after runtime creation, while Go operations
accept a `context.Context` and serialize calls to one instance.

Disposing or closing a runtime releases every instance. Individual disposal and
close operations are idempotent, and later use is rejected. Parsed `Document`
values do not reference Wasm memory and remain usable after later parsing or
disposal; serialize them with `json.Marshal` only when JSON is needed.

Markdown source is limited to 64 KiB of UTF-8. TypeScript rejects unpaired
surrogates and preserves structured parse details in `Error.cause`. Input and
native resource-limit errors do not invalidate a parser; replace an instance
after a Wasm trap or corrupted exchange.

## Parsing, rendering, and extraction

Only a parser selects a grammar version. Renderers and extractors consume the
`Document` produced by that parser and never reparse its source. The native API
is `extraction::Extractor::extract(&Document)` and
`rendering::PlainTextRenderer::render(&Document)`.

Wasm provides equivalent configure and operation pairs for extractors and
renderers. Each operation accepts document JSON, validates it with the Rust
codec, then invokes the native consumer. Replies carry either a result or an
error; errors have no stable machine-readable classification.

The extractor returns message text, references, attachments, citations, and an
embedding plan. The plain-text renderer returns notification text. TypeScript
HTML rendering uses the same `Document` directly on the host. `messageRenderers`
creates standard and condensed views from shared options; structure belongs to
node handlers, and core's fallback returns only escaped source text.

## Limits and persistence

Markdown input is limited to 64 KiB. The Rust transport accepts at most 1 MiB of
AST JSON and 32 MiB of Wasm memory; decoded documents retain parser limits on
source size, depth, and node count. These limits apply independently of Go
cancellation and disposal rules.

Store source text and its persistent grammar version, not a serialized AST.
Parse stored text again with its matching preset. The SDK intentionally provides
no compatibility layer for persisted ASTs.
