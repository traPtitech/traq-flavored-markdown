# Markdown core

The grammar-independent foundation of the engine. It contains no CommonMark or
traP syntax, node types, or presets.

| Crate                                                  | Purpose                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `markdown-ast`                                         | Typed AST, source text, and UTF-8 spans                  |
| `markdown-definitions` / `markdown-definitions-derive` | Shared declarations and node-type metadata               |
| `markdown-parser`                                      | Grammar composition, rule execution, and resource limits |
| `markdown-renderer`                                    | Typed AST rendering framework                            |
| `markdown-extractor`                                   | Typed AST extraction framework                           |
| `markdown-codec`                                       | JSON encoding and decoding for registered node contracts |

Each crate documents its own API. Follow the repository
[development guide](../../CONTRIBUTING.md) for common setup and verification.

## Package boundaries

Core does not depend on extensions. It provides the layers used by:

- [commonmark-plugin](../plugins/commonmark/README.md), which implements
  CommonMark and generic extensions;
- [traq-plugin](../plugins/traq/README.md), which implements traP extensions;
- [SDK](../sdk/README.md), which composes traQ presets and ships Wasm, TypeScript,
  and Go bindings.

Parsers, renderers, and extractors share native ASTs without depending on the
codec. The AST crate itself uses only the standard library, so applications that
only inspect ASTs do not need parser, renderer, or serialization dependencies.

## TypeScript and Go

`@traq-markdown-engine/core` exports shared AST types, renderer primitives,
contract validation, and generation support. HTML renderer handlers draw child
nodes with `ctx.render(nodes)`. The default fallback returns escaped source text
without markup; paragraph and other structural markup belongs to node handlers.

The Go module `github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go`
owns the shared `ast` and Wasm `binding` packages. It has no CommonMark or traQ
preset dependency; extension modules provide node payload types.
