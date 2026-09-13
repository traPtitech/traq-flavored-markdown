# markdown-parser

The grammar-independent parsing core. It executes rules, tracks source spans,
handles delimiters, composes grammars, and enforces resource limits. It contains
no CommonMark or traQ grammar, node contracts, or codec dependency.

```rust
use markdown_definitions::Plugin as Declaration;
use markdown_parser::{GrammarBuilder, NodeData, Parser, Plugin};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {}

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
change. A grammar needs one plain-text provider. Nodes need `NodeData`, but do
not need serde or codec registration. Completed ASTs are validated against data,
span, depth, and node-count constraints.

`bindings::Catalog` is a distribution-layer API. It registers implementations
with `plugin(&plugin)` and validated preset compositions with `preset(&builder)`.
Its numeric handles are internal binding references, not persistent IDs. Normal
applications should use the preset instances from their distribution package.
Serde is used for binding configuration and errors; AST JSON belongs to
`markdown-codec`.

The public TypeScript and Go SDKs use this core through the Wasm distribution
layer. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms.
