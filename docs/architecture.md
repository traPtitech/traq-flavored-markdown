# Architecture and ownership

The repository is organized by responsibility first, then by language within a
package. Public packages can be installed independently, but release together at
one shared version.

| Location                                             | Responsibility                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/core`                                      | Grammar-independent AST, declarations, parsing, rendering, extraction, and codec |
| `packages/plugins/commonmark`                        | CommonMark contracts, syntax, and rendering                                      |
| `packages/plugins/extensions`                        | Optional math, table, mark, strikethrough, and linkify features                  |
| `packages/plugins/traq`                              | traP extension contracts, syntax, rendering, and extraction                      |
| `packages/sdk/crates/features`                       | Shared feature assembly table and profile selection                              |
| `packages/sdk/crates/grammar`                        | Published grammar presets and their catalog                                      |
| `packages/sdk/crates/processing`                     | traQ plain-text, message, and extraction policies                                |
| `packages/sdk/crates/wasm`                           | Wasm ABI and exported contracts                                                  |
| `packages/sdk/typescript/runtime`, `packages/sdk/go` | ABI transport, processor lifecycle, and artifact selection                       |
| `packages/sdk/typescript/messages`                   | Message analysis, resource cards, and reference source edits                     |
| `packages/sdk/typescript/profiles`                   | traQ display policy and application adapters                                     |
| `packages/sdk/styles`                                | traQ presentation CSS                                                            |
| `packages/sdk/scripts`                               | SDK artifact build and distribution-specific generation                          |
| `scripts/codegen`                                    | Shared Go and TypeScript contract generation and its tests                       |
| `scripts/checks`                                     | Dependency-boundary, generated-source, and packed-consumer checks                |
| `tools/corpus`                                       | Corpus collection and comparison CLI, viewer, dependencies, and tests            |
| `tests/fixtures`                                     | Shared CommonMark specification data and attribution                             |
| `packages/sdk/tests/fixtures`                        | Reviewed traQ syntax and processing expectations across languages                |

## Dependency direction

Keep implementation code with its owner, grouped into `crates`, `typescript`,
and `go` where applicable.

```text
SDK
 ├─ core
 ├─ commonmark-plugin ──> core
 ├─ extensions-plugin ──> core and CommonMark syntax where needed
 └─ traq-plugin ────────> core and commonmark-plugin
```

Core never depends on plugins or traQ. Plugins may depend on core; traP syntax
also uses CommonMark syntax. The SDK composes the lower layers for traQ and owns
application policy. Parsers, renderers, and extractors share a native AST without
depending on the codec or the Wasm distribution.

Workspace descriptors declare owners and permitted dependency directions.
Actual npm, Cargo, and Go graphs are read separately. Package ordering and npm
peer dependencies do not implicitly define cross-language ownership rules.

## Boundary vocabulary

| Term                                     | Meaning                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Payload (`Text`, `Stamp`, `Table`, etc.) | A node's semantic data, separate from its source span and children; public payload names have no `Data` suffix |
| Node definition                          | A node identity, payload validator, role, and child-structure contract                                         |
| Plugin declaration                       | Names and identities without an execution implementation                                                       |
| Syntax / render plugin                   | Rules or handlers implementing selected declarations                                                           |
| Registration handle                      | A builder entry that survives replacement of the registered value                                              |
| Validated document / document context    | Checked immutable ownership or borrowing for consumers                                                         |
| Render session                           | Reusable context and rendering configuration                                                                   |
| Render plan                              | Node selections, omissions, plain-text child replacements, and separators                                      |
| Source-preserving message text           | Markdown source with semantic references restored to labels                                                    |
| Display plain text                       | Text produced by interpreting document structure                                                               |
| Reference embedding                      | Lookup candidates and edits that insert reference notation into source                                         |
| Resource card                            | File, message, or URL metadata used alongside rendered HTML                                                    |
| `TraqUrlClassifier`                      | Lexical classification of absolute traQ resource URLs; an empty origin disables it                             |

Source span operations preserve UTF-8 byte boundaries and original BOM, CRLF,
and NUL characters. Immutable contexts support shared analysis and rendering;
editing a caller-owned AST requires a new context. Unknown nodes remain usable
through core fallback and extension traversal, while malformed known payloads
fail validation. Custom inline or block nodes declare their role to participate in
known parent structures. The SDK's Wasm codec uses a closed set of shipped wire
contracts; core and TypeScript render plugins can register application nodes.

CommonMark parsing owns URL encoding and syntax recognition. Display profiles
own URL acceptance, image domains, raw HTML, spacing, and presentation adapters.
The traQ `spacing` feature retains additional source blank lines; empty quote
visibility belongs to presentation. It is not a legacy API compatibility layer.

## Placement rules

Code that knows traQ presets or SDK artifact metadata belongs in `packages/sdk`.
Shared generators belong in `scripts/codegen`; keep their tests beside the
generator. Root entry points coordinate package-level tools rather than replacing
their ownership.

Package README files describe public APIs and local responsibilities. This
document is the source of truth for cross-package ownership.
