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

- the CommonMark plugin, which implements CommonMark;
- the extensions plugin, which implements math, tables, and other optional syntax;
- the traQ plugin, which implements traP extensions;
- the SDK, which composes traQ presets and ships Wasm, TypeScript, and Go
  bindings.

Parsers, renderers, and extractors share native ASTs without depending on the
codec. The AST crate itself uses only the standard library, so applications that
only inspect ASTs do not need parser, renderer, or serialization dependencies.

## TypeScript and Go

`@traq-flavored-markdown/core` exports shared AST types, `SourceText`,
`DocumentContext`, and typed `NodeDefinition` values. `SourceText` slices and edits
UTF-8 byte spans, preserving BOM, CRLF, and NUL. A `DocumentContext` owns a frozen
snapshot after checking the tree, sibling order, source boundaries, and resource
limits. Pass `{ definitions }` to validate known payloads and child structure;
render sessions supply their registered definitions automatically. It never freezes
the caller's mutable document. Create a
new context after editing that document.

`RenderPlugin.on(definition, handler)` infers the payload type and registers its
validator and structure. A definition declares whether its node is inline, block,
structural, or opaque, plus the allowed children. Custom nodes used inside a known
paragraph or another constrained parent must declare the appropriate role:

```ts
const mention = defineNode<{ kind: 'app.mention'; data: { id: string } }>(
  'app.mention',
  data =>
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string',
  { role: 'inline', children: { kind: 'leaf' } }
)
```

String registrations remain available for opaque application nodes. Unknown
nodes can occur at roots or below unconstrained parents; they do not bypass a
known parent's child contract. `context.validateDefinitions(definitions)` validates
additional definitions on the owned snapshot and rejects conflicting structures.

`PluginDeclaration` names a plugin; `RenderPlugin` contains its handlers;
`PresetBuilder.register()` returns a durable `RegistrationHandle` used for
replacement or removal. Built presets retain their own snapshots.

`renderer.createSession(documentOrContext)` reuses one validated context across
renders. A `RenderPlan` selects roots, omits nodes, or replaces a node's rendered
children with escaped plain text. Every node in the plan must belong to the
document. `ctx.renderChildren()` dispatches this node's visible children and
applies its replacement. It accepts a separator or a callback joining already
rendered children for containers such as lists and tables. `ctx.renderNode(node)`
dispatches an existing node with its original ancestors and sibling index.
`ctx.sourceSlice(span)` reads its original source; the default fallback emits
escaped source without markup. `renderer.render(document, plan)` creates a
session for one render.

The Go module `github.com/traPtitech/traq-flavored-markdown/packages/core/go`
owns the shared `ast` and Wasm `binding` packages. It has no CommonMark or traQ
preset dependency; extension modules provide node payload types.
