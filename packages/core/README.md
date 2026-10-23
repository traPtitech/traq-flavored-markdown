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

`@traq-flavored-markdown/core` exports explicit `MutableDocument`/`MutableNode` drafts,
`ReadonlyDocument`/`ReadonlyNode` snapshots, `SourceText`, `DocumentSchema`, and
`DocumentContext<Variant>`. A schema owns immutable node definitions independently
of render handlers. It validates payloads and child structure even when no HTML
handler renders a node. Generated plugin `/nodes` entrypoints export `schema`,
`definitions`, `names`, and the discriminated `NodeVariant` union.

`schema.document(rawDocument)` validates and snapshots the complete tree. The
result owns deeply frozen source data, spans, children, and payloads. It preserves
the schema's node union for traversal and accepts reuse by independent consumers.
`context.toMutable()` makes an independent draft; validate that draft again after
editing. `SourceText` slices and edits UTF-8 byte spans while preserving BOM, CRLF,
and NUL. `DocumentValidationError` exposes `code`, `path`, and optional `resource`.

Schemas reject unknown nodes by default. `schema.withUnknownNodes()` preserves
opaque application nodes while validating known contracts; unknown children do
not bypass a known parent's child constraints. Extend a schema with typed
application contracts before using custom nodes inside constrained parents:

```ts
import { schema } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import { defineNode } from '@traq-flavored-markdown/core'

const mention = defineNode<{ kind: 'app.mention'; data: { id: string } }>(
  'app.mention',
  data =>
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string',
  { role: 'inline', children: { kind: 'leaf' } }
)
const applicationSchema = schema.extend([mention])
const context = applicationSchema.document(rawDocument)
```

`RenderPlugin.withHandler(definition, handler)` infers validated payload types.
`withReplacedHandler` replaces a handler. Both return a new immutable plugin;
retain the returned value. String registrations handle opaque nodes.
`PluginDeclaration` names a plugin; `PresetBuilder` composes handlers into an
`HtmlPreset`. Registration handles support replacement and removal.

`createRenderer(preset, { schema })` accepts external trees under an explicit
schema. A renderer without a schema accepts previously validated contexts; typed
handlers require their node contracts to be present. `createSession(context)`
reuses ownership across renders. `RenderPlan` selects roots, omits nodes, and
replaces rendered children with escaped text. Plan nodes must belong to the
document. `ctx.renderChildren()` accepts a separator or joining callback,
`ctx.renderNode(node)` retains original ancestry, and `ctx.parent(definition)` or
`ctx.matches(node, definition)` narrows validated nodes without rerunning payload
guards. The default fallback emits escaped original source.

Generic URL defaults `validateLink` and `validateImage` live in `core/html`.
Applications and plugins can select policy without depending on CommonMark.

The Go module `github.com/traPtitech/traq-flavored-markdown/packages/core/go`
owns the shared `ast`, JSON `contract`, and Wasm `binding` packages. It has no CommonMark or traQ
preset dependency; extension modules provide node payload types.
