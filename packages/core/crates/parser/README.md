# markdown-parser

The grammar-independent parsing core. It executes rules, tracks source spans,
handles delimiters, composes grammars, and enforces resource limits. It contains
no CommonMark or traQ grammar, node contracts, or codec dependency.

```rust
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_parser::GrammarBuilder;
use markdown_parser::NodeData;
use markdown_parser::NodeRole;
use markdown_parser::Parser;
use markdown_parser::SyntaxPlugin;

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
let mut plugin = SyntaxPlugin::new(&declaration);
plugin.text(Text);
let mut builder = GrammarBuilder::new();
builder.add(&plugin)?;
let parser = Parser::new(&builder.build()?);
let document = parser.parse_inline("hello")?;
assert_eq!(document.children[0].payload::<Text>(), Some(&Text("hello".into())));
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
`DocumentView::with_limits` using the same `Limits::document` value.

Inline and text rules exchange `ViewOffset` and `ViewRange`; block rules receive
`LineIndex` values and typed view ranges for their lines. `SourceView::span_for`
maps those ranges to original UTF-8 source spans, preserving CRLF, NUL, tab, and
container transformations. `SourceView::range` and `offset` check raw byte indexes
at scanner boundaries. Original `SourceOffset` values cannot be used as match
endpoints. Cursor advancement and accepted matches still validate UTF-8 boundaries
and charge the shared work budget.

`SourceView::source_spans(range)` returns the original UTF-8 byte spans that
actually contribute to a view range. It excludes removed quote/list prefixes and
table escapes, even after nested selections. Successive forward spans that touch
or overlap are coalesced; otherwise they remain in view order. An empty range
has no contributing source. CRLF and NUL normalization retain their complete
original spelling, and any selected part of an expanded tab refers to the whole
original tab. These spans describe source coverage, not decoded display text.
`span_for` and `source_offset` keep their existing boundary mapping for AST
envelopes and diagnostics. A joined boundary can therefore include a removed
prefix in an AST envelope while `source_spans` excludes it. Internally, exact
origins use compact linear/replacement segments shared by contiguous subviews.

`Parser::parse_with_syntax` and `parse_inline_with_syntax` return a document and
an accompanying `SyntaxTree`. Its children mirror the AST exactly, including
nodes without detailed source facts. Each `NodeSyntax::source` optionally
contains original-byte `content` ranges and grouped markers (`open`, `close`,
`prefix`, `info`, `separator`, or `definition`). Prefix markers also retain the
number of consumed parser-view columns, including partially consumed tabs.
Accepted definitions without AST nodes appear in `SyntaxTree::detached`.
Rules construct facts with `SourceView::syntax` or `prefix_syntax`, then attach
them with `InlineMatch::with_syntax`, `DraftNode::with_syntax`, or
`BlockMatch::with_syntax` for detached markers. Constructors return `None` during
ordinary parsing. `captures_syntax()` lets rules avoid optional preparation.
Delimiter pairing and bracket resolution record their accepted markers directly;
no second parser or source heuristic reconstructs those decisions. Captured
facts are checked against the original UTF-8 source and charged to the parse
work budget. Ordinary `parse` and `parse_inline` do not build the syntax tree.

`bindings::Catalog` is a distribution-layer API. It registers implementations
with `plugin(&plugin)` and validated preset compositions with `preset(&builder)`.
Its numeric handles are internal binding references, not persistent IDs. Normal
applications should use the preset instances from their distribution package.
The parser has no serde or schema dependency. Distribution bindings own their
configuration and error DTOs; AST JSON belongs to `markdown-codec`.

The public TypeScript and Go SDKs use this core through the Wasm distribution
layer. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms.

Public APIs are organized by responsibility: `grammar` supplies composition,
`rules` supplies block/inline matches, budgets, and parse state, and `source`
supplies checked source coordinates. The parser execution engine is private.
