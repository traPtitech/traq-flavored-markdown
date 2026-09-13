# Core crates

These independently published Cargo packages provide the grammar-independent
layers of the engine.

| Directory                            | Package                       | Purpose                                       |
| ------------------------------------ | ----------------------------- | --------------------------------------------- |
| [ast](ast/README.md)                 | `markdown-ast`                | Typed AST with no grammar or serde dependency |
| [definitions](definitions/README.md) | `markdown-definitions`        | Shared plugin declarations and node metadata  |
| `definitions-derive`                 | `markdown-definitions-derive` | `NodeType` derive implementation              |
| [parser](parser/README.md)           | `markdown-parser`             | Grammar composition and rule execution        |
| [renderer](renderer/README.md)       | `markdown-renderer`           | Typed handler-based rendering                 |
| [extractor](extractor/README.md)     | `markdown-extractor`          | Typed handler-based extraction                |
| [codec](codec/README.md)             | `markdown-codec`              | JSON transport for registered node contracts  |

The AST can be used without a parser, renderer, codec, or serde. Parsers,
renderers, and extractors share native ASTs without depending on the codec.
CommonMark and traP packages depend on this layer but are versioned separately.

Develop from the repository root; see the [development guide](../README.md) for
common commands.
