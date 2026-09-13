# traQ plugin

This package provides the traP-specific Markdown extensions used by traQ. The
[SDK](../../sdk/README.md) chooses their grammar order and ships the resulting
presets, bindings, and application policies.

| Crate                      | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `markdown-trap-contracts`  | Nodes for stamps, references, spoilers, and blank lines |
| `markdown-trap-syntax`     | traP syntax                                             |
| `markdown-trap-text`       | Plain-text rendering for traP nodes                     |
| `markdown-trap-extraction` | Reference extraction                                    |

Add the individual rule plugins to an application's `GrammarBuilder` or
`PresetBuilder`. The caller selects their order and decides notification URL
display and how processing results are combined.

## Boundaries

This package uses [core](../../core/README.md) and
[commonmark-plugin](../commonmark/README.md) from the same workspace. It does
not depend on SDK composition or distribution code.

The TypeScript package exports generated node types and HTML renderers. The Go
module is `github.com/uni-kakurenbo/traq-markdown-engine/packages/plugins/traq/go`;
its payloads and node factories are generated from these Rust contracts. The
shared AST and Wasm runtime remain in the core Go module.

Follow the repository [development guide](../../../CONTRIBUTING.md). See the
[processing presets](../../sdk/crates/processing/README.md) for the traQ
composition and runnable examples.
