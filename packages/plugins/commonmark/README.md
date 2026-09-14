# CommonMark plugin

This package provides CommonMark 0.31.2 and reusable Markdown extensions. It
owns their grammar, node contracts, and plain-text rendering, while the SDK
chooses which plugins form the traQ presets.

| Crate                           | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `markdown-commonmark-contracts` | Typed CommonMark nodes                          |
| `markdown-commonmark`           | CommonMark syntax                               |
| `markdown-commonmark-text`      | CommonMark plain-text rendering                 |
| `markdown-generic-contracts`    | Nodes for math, tables, strikethrough, and mark |
| `markdown-generic-syntax`       | Reusable extension syntax                       |
| `markdown-generic-text`         | Reusable extension plain-text rendering         |

The crates can be used independently. Contract and syntax crates live together,
but a consumer that only reads nodes does not need a parser implementation.

## Boundaries

This package depends on core and does not know about traP syntax, traQ presets,
or application policy. Those responsibilities belong to the traQ plugin and SDK.

The TypeScript package exports generated node types and HTML renderers. The Go
module is `github.com/uni-kakurenbo/traq-markdown-engine/packages/plugins/commonmark/go`;
its payloads and node factories are generated from these Rust contracts. The
shared AST and Wasm runtime remain in the core Go module.

Attribution and licensing for the 652 CommonMark examples are in the
[shared fixtures](../../../tests/fixtures/README.md).
