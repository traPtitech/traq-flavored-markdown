# SDK implementation notes

This guide describes the native/host boundary. The [SDK README](../README.md)
owns public usage examples.

## Ownership and generated contracts

Rust owns grammar composition, parsing, typed payloads, and semantic validation.
[The feature table](../crates/features/src/table.rs) joins each feature's shared
declarations, node contracts, implementation factories, and profile membership.
Grammar and plain-text assemblies select from that table; optional Cargo features
keep their parser and renderer dependencies separate. The SDK profile also owns
the frozen TLD policy passed to the configurable link recognizer.
[The preset catalog](../crates/grammar/src/bindings/presets.rs) names the shipped
grammars. [The node codec](../crates/wasm/src/nodes.rs) registers the selected node
contracts. Distribution catalogs live in the SDK; the core parser retains its
native composition types without JSON metadata.

A document is `{ source, children }`; a node is
`{ kind, span, data, children? }`. Spans address UTF-8 bytes in the original
source. Node identities are independent of Rust type names and package paths.
CommonMark, optional extensions, and traQ contracts have separate owners.
Generated TypeScript `NodeDefinition` values combine kind, payload validator, role,
and child-structure constraints;
the SDK publishes their union while core permits application-defined nodes.

The normalized contract model preserves request/response direction, defaults,
named references, and tagged unions. Request schemas use Rust deserialization
contracts; response schemas use serialization contracts. Unsupported constraints
and generated-name collisions fail generation. Output manifests define the
managed source files, so generation and stale-output checks use the same plan.

Payload guards alone do not validate tree shape or source spans. TypeScript
`DocumentContext` checks and owns an immutable snapshot before analysis or
rendering. Rust has borrowed and owned validated documents; Go's validated owner
retains a checked wire snapshot. These values allow consumers to reuse the
boundary guarantee. User-owned mutable trees are not frozen or cached by identity.
Known parent constraints apply to custom nodes as well; custom TypeScript nodes
must declare their role before the context is validated. The Wasm wire codec
accepts the SDK's closed set of built-in contracts.

## Artifact identity and transport

[The ABI descriptor](../crates/wasm/src/abi.rs) defines operations, argument
shapes, success categories, required exports, and error codes. Generated host
descriptors are consumed by [TypeScript transport](../typescript/src/runtime/transport.ts)
and the core Go binding. Each reply has exactly one outcome: `{ ok: value }` or
`{ error: { code, message, resource?, path?, offset?, span? } }`.

The semantic contract ID hashes the ABI, node and processing schemas, presets,
and limits. Source provenance identifies implementation inputs; the Wasm SHA-256
identifies the exact artifact. These serve different purposes. Contract matching
is a compatibility check, not a signature. The SDK build pipeline binds the ID
into Wasm and records the artifact metadata in `dist/contract.json`.

`createRuntime` and `NewRuntime` compile once. Every parser, extractor, and native
plain-text renderer owns an independent instance. The browser `loadRuntime`
retains its shared runtime for the page and exposes processor factories. Go
serializes calls to an instance and accepts cancellation contexts; TypeScript
calls are synchronous after compilation.

Runtime disposal closes all instances. Individual disposal is idempotent.
Documents and extracted results own their host data and survive later calls or
disposal. Domain errors leave the processor reusable. Traps, invalid memory
ranges, malformed replies, and invalid success values close the affected
instance. Later calls report `disposed`. `MarkdownError` / `*markdown.Error`
expose codes and structured positions without requiring message-text parsing.

## Analysis and presentation

A parser selects a grammar. Renderers and extractors consume its document and do
not parse the Markdown source again. Bounded codec decoding produces an owned
validated document; Wasm passes that guarantee into native processing.

Native collectors share one traversal for references, source-preserving message
text, source edits, and reference-embedding candidates. Native display plain text
is a separate consumer. The bounded renderer writes into a sink and captures
children only for handlers that transform their output.
`TraqUrlClassifier` classifies absolute file and message URLs by a configured
lexical prefix; an empty origin disables it. It does not resolve relative URLs.

TypeScript separates [message analysis](../typescript/src/messages/analysis.ts),
[resource-card classification](../typescript/src/messages/cards.ts),
[reference embedding](../typescript/src/messages/reference-embedding.ts),
[display policy](../typescript/src/profiles/traq.ts), and
[renderer assembly](../typescript/src/renderer/index.ts). `messageRenderers.prepare`
shares one context and analysis between standard and condensed views. A render
plan holds node selections, omissions, replacement child text, and separators.

Every visible node, including table rows and cells, passes through the same
renderer dispatcher. `renderChildren` applies node-bound replacement before
joining dispatched children. Table alignment belongs to the table; list kind
holds numbering semantics; stamp colors are numeric. Original notation remains
available through the source span or literal payload.

The traQ profile controls extra blank-line presentation, empty quote visibility,
URL/image policy, card suppression, and default adapters. Application reference
and stamp resolvers own stores and routes. Syntax parsing encodes URLs but does
not choose a renderer's destination policy.

## Source, limits, and persistence

Source APIs preserve BOM, CRLF, NUL, and Unicode while checking byte boundaries.
Reference embedding checks all candidate spans and original text before any
lookup callback runs, then applies disjoint source edits.

Transport limits and document limits are distinct: the Wasm input buffer accepts
1 MiB of request JSON, while source text is limited to 64 KiB. Documents also
bound payload bytes, nodes, and nesting. Output and parser work are bounded
independently. Generated artifact metadata records the applicable limits.
TypeScript request encoding checks plain data properties, Unicode, nesting, and
the encoded byte budget before allocating the Wasm input. It does not invoke
application getters or serialization hooks. Rejected requests retain their typed
error code and operation, and leave the processor available for subsequent calls.

Store source text and its grammar version, and parse with that version when
reading it. Serialized ASTs are not a persistence format. Changes to the
unreleased contract and internal layout need no legacy API shim.
