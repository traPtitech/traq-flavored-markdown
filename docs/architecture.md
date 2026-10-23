# Architecture and ownership

The repository is organized by responsibility first, then by language within a
package. Public packages can be installed independently, but release together at
one shared version.

| Location                                                 | Responsibility                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/core`                                          | Grammar-independent AST, declarations, parsing, rendering, extraction, and codec |
| `packages/plugins/commonmark`                            | CommonMark contracts, syntax, and rendering                                      |
| `packages/plugins/extensions`                            | Optional math, table, mark, strikethrough, and linkify features                  |
| `packages/plugins/traq`                                  | traQ extension contracts, syntax, rendering, and extraction                      |
| `packages/sdk/crates/features`                           | Feature capabilities and ordered profiles                                        |
| `packages/sdk/crates/grammar`                            | Published grammar presets and their catalog                                      |
| `packages/sdk/crates/processing`                         | traQ plain-text, message, and extraction policies                                |
| `packages/sdk/crates/wasm`                               | Wasm ABI and exported contracts                                                  |
| `packages/sdk/typescript/src/runtime`, `packages/sdk/go` | ABI transport, processor lifecycle, and artifact selection                       |
| `packages/sdk/typescript/src/traq/messages`              | Message analysis, resource cards, and reference source edits                     |
| `packages/sdk/typescript/src/traq/profile`               | traQ display policy                                                              |
| `packages/sdk/typescript/src/traq/views`                 | Standard and condensed render plans                                              |
| `packages/sdk/typescript/src/adapters`                   | Optional highlighting and math integration                                       |
| `packages/plugins/*/styles`                              | CSS required by each plugin's markup                                             |
| `packages/sdk/styles`                                    | traQ presentation CSS                                                            |
| `packages/sdk/scripts`                                   | SDK artifact build and distribution-specific generation                          |
| `tools/contracts`                                        | Typed Rust contract exports, shared Go/TypeScript generators, and tests          |
| `tools/workspace`                                        | Build graph, dependency policy, checks, release, and process infrastructure      |
| `scripts`                                                | Thin developer command entrypoints                                               |
| `tools/corpus`                                           | Corpus collection and comparison CLI, viewer, dependencies, and tests            |
| `tests/fixtures`                                         | Shared CommonMark specification data and attribution                             |
| `packages/sdk/tests/fixtures`                            | Reviewed traQ syntax and processing expectations across languages                |

## Dependency direction

Keep implementation code with its owner, grouped into `crates`, `typescript`,
and `go` where applicable. TypeScript implementations and generated contracts
live in `typescript/src`; tests live in `typescript/tests`, beside the TypeScript
configuration files. Builds emit the contents of `src` directly into `dist`.

```text
SDK
 ├─ core
 ├─ commonmark-plugin ──> core
 ├─ extensions-plugin ──> core and CommonMark syntax where needed
 └─ traq-plugin ────────> core and commonmark-plugin
```

Core never depends on plugins or traQ. Plugins may depend on core; traQ syntax
also uses CommonMark syntax. The SDK composes the lower layers for traQ and owns
application policy. Parsers, renderers, and extractors share a native AST without
depending on the codec or the Wasm distribution.

Workspace descriptors declare owners and permitted dependency directions.
Actual npm, Cargo, and Go graphs are read separately. Package ordering and npm
peer dependencies do not implicitly define cross-language ownership rules.

Plugin-owned feature catalogs are the single source of payload membership and
contract metadata. The SDK selects their public exports, factories, order, and
precedence. `GrammarProfile` and `TextProfile` expose only their applicable
capabilities; selected text features always carry a text factory. Text factories
and block sequence policies remain separate providers with independent uniqueness
checks. Every production crate has an explicit capability policy in addition to
its package owner policy.

## Boundary vocabulary

| Term                                     | Meaning                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Payload (`Text`, `Stamp`, `Table`, etc.) | A node's semantic data, separate from its source span and children; public payload names have no `Data` suffix |
| Node definition                          | A node identity, payload validator, role, and child-structure contract                                         |
| Plugin declaration                       | Names and identities without an execution implementation                                                       |
| Syntax / render plugin                   | Rules or handlers implementing selected declarations                                                           |
| Registration handle                      | A builder entry that survives replacement of the registered value                                              |
| `MutableDocument`                        | An editable draft that must cross a validation boundary before consumption                                     |
| `Document` / `DocumentContext`           | Checked immutable ownership returned by parsing and decoding                                                   |
| `DocumentView`                           | A borrowed native validation proof                                                                             |
| `DocumentSchema`                         | Immutable TypeScript contracts independent of display handlers                                                 |
| `NodeVariant`                            | The discriminated union of node kind and semantic payload                                                      |
| Render session                           | Reusable context and rendering configuration                                                                   |
| Render plan                              | Node selections, omissions, plain-text child replacements, and separators                                      |
| Source-preserving message text           | Markdown source with semantic references restored to labels                                                    |
| Display plain text                       | Text produced by interpreting document structure                                                               |
| Reference embedding                      | Lookup candidates and edits that insert reference notation into source                                         |
| Resource card                            | File, message, or URL metadata used alongside rendered HTML                                                    |
| `TraqUrlClassifier`                      | Lexical classification of absolute traQ resource URLs; an empty origin disables it                             |

Source span operations preserve UTF-8 byte boundaries and original BOM, CRLF,
and NUL characters. Immutable contexts support shared analysis and rendering;
editing explicitly creates a mutable draft and then a new validated owner.
TypeScript schemas reject unknown nodes by default; `withUnknownNodes()` opts into
preserving opaque application nodes while continuing to check known payloads.
Custom inline or block nodes declare their role in a schema to participate in
known parent structures. Render handlers are selected separately. The SDK's Wasm
codec uses a closed set of shipped wire contracts.

Native node roles come from their static structure contract. Validation always
checks that structure before payload-specific validation. A small payload derive
shares field constraints with JSON Schema and generates accounting boilerplate.
Core describes child roles, kinds, and sequences; table-specific payload fields
and row arity are supplied by the extensions contract. Generated TypeScript and
Go validators consume the same exported structure.

TypeScript distinguishes editable `MutableDocument`/`MutableNode` input from
`ReadonlyDocument`/`ReadonlyNode` snapshots. Render handlers, traversal, and plans
retain readonly payload and ancestor types. Native parser APIs distinguish
`SourceOffset` from `ViewOffset` through matching, slicing, and source joins;
conversion to original byte spans occurs through the source map.

Go `Document` exposes read-only source, node, span, and child accessors. Payload
decoding and `ToMutable` return detached caller-owned values; the wire snapshot is
reused by consumers. Rust consumers accept the document owner or borrowed view;
drafts are validated at the boundary. There are no parallel `*Validated` consumer
APIs.

CommonMark parsing owns URL encoding, code language interpretation, and syntax recognition. Display profiles
own URL acceptance, image domains, raw HTML, spacing, and presentation adapters.
The traQ `spacing` feature retains additional source blank lines; empty quote
visibility belongs to presentation. It is not a legacy API compatibility layer.

The SDK's fused processor parses, validates, extracts, and produces plain text
using one native document and one Wasm call. The codec's serialization view writes
that document directly into the bounded response without a JSON intermediate.
Separate operations support callers that need only one consumer. The HTML
entrypoint is lightweight; `sdk/adapters` explicitly supplies highlighting and
math through `withDefaultAdapters`. These libraries are optional peer dependencies.

The contract ID hashes wire semantics, including constraints, defaults, ordered
ABI parameters, presets, and limits. Documentation and generated type display names
do not affect it. Source fingerprints and artifact digests identify build inputs
and exact bytes separately. Runtime limits and linker memory use shared native
definitions; host limits and wire error decoders are generated from those contracts.

## Placement rules

Code that knows traQ presets or SDK artifact metadata belongs in `packages/sdk`.
Shared generators belong in `tools/contracts/model`, `emitters`, and `io`; their
tests live in `tools/contracts/tests`. `tools/workspace/generate.ts` assembles
owner-specific targets. Contract generation, TypeScript, styles, Wasm, and artifact
metadata are separate build tasks, and selected builds visit only their required
owners. Root entry points coordinate package-level tools.

Corpus commands create a comparison run with immutable outputs, input/artifact
digests, revision and environment metadata, and a completion manifest. A shared
protocol defines TypeScript and Go outcomes; each side is either a typed success
or a typed error. Baseline caches are separate from run outputs. The viewer query
controller owns filter, search, mode, and normalized page transitions; components
render those values without retaining a competing page state.

Package README files describe public APIs and local responsibilities. This
document is the source of truth for cross-package ownership.
