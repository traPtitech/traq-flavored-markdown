# markdown-renderer

The grammar-independent framework for rendering typed AST nodes to strings. It
depends only on the AST and shared declarations, not on CommonMark, traQ, a
parser, or a codec.

```rust
use markdown_ast::{Document, Node, NodeData, NodeRole, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_renderer::{Plugin, PresetBuilder, Renderer};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {
    fn role(&self) -> NodeRole { NodeRole::Inline }
    fn payload_bytes(&self) -> usize { self.0.len() }
}

let prefix = String::from("hello ");
let mut plugin = Plugin::new(&Declaration::new("greeting"));
plugin.on::<Text>(move |text, _, _| Ok(format!("{prefix}{}", text.0)))?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
let renderer = Renderer::new(&builder.build()?);
let document = Document {
    source: "world".into(),
    children: vec![Node::leaf(Span { start: 0, end: 5 }, Text("world".into()))],
};
assert_eq!(renderer.render(&document)?, "hello world");
# Ok::<(), &'static str>(())
```

`Plugin::on` registers a handler for one concrete node type. Handler closures
are `Send + Sync` and can retain configuration. `replace::<T>` changes a
registered handler in that plugin; missing and duplicate handlers fail without
changing its snapshot. Builders, presets, and renderers preserve the snapshot
that was registered, so later plugin edits do not alter them.

`render` validates every node, including descendants a parent handler chooses
not to emit, before rendering. Handlers own escaping and other output semantics.
Default limits are 65,536 source bytes, 8 MiB of payload, 16,384 nodes, depth 64, 1 MiB output,
and 8 MiB cumulative appends. Trusted handler code owns its own work limits.

Use `render_validated(ValidatedDocument)` to reuse a shared immutable tree
validation. It still checks handler coverage and per-render output limits.
