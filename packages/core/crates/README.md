# Core crates

These workspace Cargo packages provide the grammar-independent layers of the
engine. They use Rust edition 2024 and the repository's pinned Rust toolchain.
The workspace currently sets `publish = false`; Rust crates are consumed from
this repository and share its workspace version. npm and Go releases follow
the package release plan maintained by the workspace tooling.

| Directory                            | Package                       | Purpose                                       |
| ------------------------------------ | ----------------------------- | --------------------------------------------- |
| [ast](ast/README.md)                 | `markdown-ast`                | Typed AST with no grammar or serde dependency |
| [definitions](definitions/README.md) | `markdown-definitions`        | Shared plugin declarations and node metadata  |
| `definitions-derive`                 | `markdown-definitions-derive` | `WireTypeKey` derive implementation           |
| [parser](parser/README.md)           | `markdown-parser`             | Grammar composition and rule execution        |
| [renderer](renderer/README.md)       | `markdown-renderer`           | Typed handler-based rendering                 |
| [extractor](extractor/README.md)     | `markdown-extractor`          | Typed handler-based extraction                |
| [codec](codec/README.md)             | `markdown-codec`              | JSON transport for registered node contracts  |

The AST can be used without a parser, renderer, codec, or serde. Parsers,
renderers, and extractors share native ASTs without depending on the codec.
CommonMark and traP packages depend on this layer and share the Rust workspace
version.
