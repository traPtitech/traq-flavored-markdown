# markdown-renderer

The grammar-independent framework for rendering typed AST nodes to strings. It
depends only on the AST and shared declarations, not on CommonMark, traQ, a
parser, or a codec.

```rust
use markdown_ast::{MutableDocument, Node, NodeData, NodeRole, Span};
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_renderer::RenderPlugin;
use markdown_renderer::RenderPresetBuilder;
use markdown_renderer::Renderer;

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

let prefix = String::from("hello ");
let mut plugin = RenderPlugin::new(&Declaration::new("greeting"));
plugin.on::<Text>(move |text, _, _, output| {
    output.push(&prefix)?;
    output.push(&text.0)
})?;
let mut builder = RenderPresetBuilder::new();
builder.add(&plugin)?;
let renderer = Renderer::new(&builder.build()?);
let document = MutableDocument {
    source: "world".into(),
    children: vec![Node::leaf(Span { start: 0, end: 5 }, Text("world".into()))],
};
assert_eq!(renderer.render(&document)?, "hello world");
# Ok::<(), markdown_renderer::Error>(())
```

`RenderPlugin::on` registers a handler for one concrete node type. Handler closures
are `Send + Sync` and can retain configuration. `replace::<T>` changes a
registered handler in that plugin; missing and duplicate handlers fail without
changing its snapshot. Builders, presets, and renderers preserve the snapshot
that was registered, so later plugin edits do not alter them.

`render` validates every node, including descendants a parent handler chooses
not to emit, before rendering. Handlers own escaping and other output semantics.
Default limits are 65,536 source bytes, 8 MiB of payload, 16,384 nodes, depth 64, 1 MiB output,
and 8 MiB of written bytes, including temporary captures. `RenderLimits` configures
output and work limits. Handlers write through `Output`; ordinary wrappers call
`context.children(nodes, output)` without allocating a subtree string. Use
`capture_children` only when transforming rendered children.

`builder.register(&plugin)` returns a `RegistrationHandle`. Removal uses that
handle, so editing the plugin never changes which registration is removed.

Use `render(&Document)` or `render(DocumentView)` to reuse a shared immutable tree
validation. It still checks handler coverage and per-render output limits.
