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

Each crate documents its own API.

## Package boundaries

Core does not depend on extensions. It provides the layers used by:

- the CommonMark plugin, which implements CommonMark and generic extensions;
- the traQ plugin, which implements traP extensions;
- the SDK, which composes traQ presets and ships Wasm, TypeScript, and Go
  bindings.

Parsers, renderers, and extractors share native ASTs without depending on the
codec. The AST crate itself uses only the standard library, so applications that
only inspect ASTs do not need parser, renderer, or serialization dependencies.

## TypeScript and Go

`@traq-flavored-markdown/core` exports shared AST types, renderer primitives,
contract validation, and generation support. HTML renderer handlers draw child
nodes with `ctx.render(nodes)`. The default fallback returns escaped source text
without markup; paragraph and other structural markup belongs to node handlers.
`renderer.render(document, overlay)` can select root nodes, omit specific nodes,
or replace a node's rendered children with plain text without changing the AST.
The renderer escapes replacement text and applies it only when a handler renders
that node's original `children` array.

The Go module `github.com/traPtitech/traq-flavored-markdown/packages/core/go`
owns the shared `ast` and Wasm `binding` packages. It has no CommonMark or traQ
preset dependency; extension modules provide node payload types.
