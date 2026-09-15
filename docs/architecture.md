# Architecture and ownership

The repository is organized by responsibility first, then by language within a
package. Public packages can be installed independently, but release together at
one shared version.

| Location                                     | Responsibility                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/core`                              | Grammar-independent AST, declarations, parsing, rendering, extraction, and codec |
| `packages/plugins/commonmark`                | CommonMark and generic extension contracts, syntax, and rendering                |
| `packages/plugins/traq`                      | traP extension contracts, syntax, rendering, and extraction                      |
| `packages/sdk/crates/grammar`                | Published grammar presets and their catalog                                      |
| `packages/sdk/crates/processing`             | traQ plain-text, message, and extraction policies                                |
| `packages/sdk/crates/wasm`                   | Wasm ABI and exported contracts                                                  |
| `packages/sdk/typescript`, `packages/sdk/go` | traQ SDK, preset, and artifact selection                                         |
| `packages/sdk/styles`                        | traQ presentation CSS                                                            |
| `packages/sdk/scripts`                       | SDK artifact build and distribution-specific generation                          |
| `scripts/codegen`                            | Shared Go and TypeScript contract generation and its tests                       |
| `scripts/checks`                             | Dependency-boundary, generated-source, and packed-consumer checks                |
| `tools/corpus`                               | Corpus collection and comparison CLI, viewer, dependencies, and tests            |
| `tests/fixtures`                             | Shared CommonMark specification data and attribution                             |
| `packages/sdk/tests/fixtures`                | Frozen traQ compatibility expectations across languages                          |

## Dependency direction

Keep implementation code with its owner, grouped into `crates`, `typescript`,
and `go` where applicable.

```text
SDK
 ├─ core
 ├─ commonmark-plugin ──> core
 └─ traq-plugin ────────> core and commonmark-plugin
```

Core never depends on plugins or traQ. Plugins may depend on core; traP syntax
also uses CommonMark syntax. The SDK composes the lower layers for traQ and owns
application policy. Parsers, renderers, and extractors share a native AST without
depending on the codec or the Wasm distribution.

## Placement rules

Code that knows traQ presets or SDK artifact metadata belongs in `packages/sdk`.
Shared generators belong in `scripts/codegen`; keep their tests beside the
generator. Root entry points coordinate package-level tools rather than replacing
their ownership.

Package README files describe public APIs and local responsibilities. This
document is the source of truth for cross-package ownership.
