# markdown-parser

The grammar-independent parsing core. It executes rules, tracks source spans,
handles delimiters, composes grammars, and enforces resource limits. It contains
no CommonMark or traQ grammar, node contracts, or codec dependency.

```rust
use markdown_definitions::Plugin as Declaration;
use markdown_parser::{GrammarBuilder, NodeData, NodeRole, Parser, Plugin};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline, children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize { self.0.len() }
}

let declaration = Declaration::new("text");
let mut plugin = Plugin::new(&declaration);
plugin.text(Text);
let mut builder = GrammarBuilder::new();
builder.add(&plugin)?;
let parser = Parser::new(&builder.build()?);
let document = parser.parse_inline("hello")?;
assert_eq!(document.children[0].get::<Text>(), Some(&Text("hello".into())));
# Ok::<(), Box<dyn std::error::Error>>(())
```

Implementations are created from shared declarations. Editing a plugin after it
is registered creates a new snapshot; existing grammars and parsers do not
change. A grammar needs one plain-text provider. Every external plugin node
implements `NodeData::structure` and `NodeData::payload_bytes` so existing block and
inline containers can validate it and its owned payload is budgeted. Nodes do
not need serde or codec registration. Completed ASTs are validated against data,
span, sibling order, depth, node count, and payload size. `Limits::document`
uses the same `ValidationLimits` as codecs and AST consumers. Its defaults are
65,536 source bytes, 8 MiB of payload, 16,384 nodes, and depth 64;
`Limits::work` is specific to parsing. A parser configured with
`Parser::with_limits` can pass its document to consumers through
`ValidatedDocument::with_limits` using the same `Limits::document` value.

Inline and text rules exchange `ViewOffset` and `ViewRange`; block rules receive
`LineIndex` values and typed view ranges for their lines. `SourceView::span_for`
maps those ranges to original UTF-8 source spans, preserving CRLF, NUL, tab, and
container transformations. `SourceView::range` and `offset` check raw byte indexes
at scanner boundaries. Original `SourceOffset` values cannot be used as match
endpoints. Cursor advancement and accepted matches still validate UTF-8 boundaries
and charge the shared work budget.

`bindings::Catalog` is a distribution-layer API. It registers implementations
with `plugin(&plugin)` and validated preset compositions with `preset(&builder)`.
Its numeric handles are internal binding references, not persistent IDs. Normal
applications should use the preset instances from their distribution package.
Serde is used for binding configuration and errors; AST JSON belongs to
`markdown-codec`.

The public TypeScript and Go SDKs use this core through the Wasm distribution
layer. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms.
