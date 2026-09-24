# markdown-extractor

Collects information from a typed AST with typed handlers. It depends only on
the AST and shared declarations, not on a grammar, parser, renderer, codec, or
traQ-specific result type.

```rust
use markdown_ast::{Document, Node, NodeData, NodeRole, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_extractor::{Extractor, Plugin, PresetBuilder};

#[derive(Debug, Clone, PartialEq)]
struct Reference(String);
impl NodeData for Reference {
    fn role(&self) -> NodeRole { NodeRole::Inline }
    fn payload_bytes(&self) -> usize { self.0.len() }
}

let mut plugin = Plugin::<Vec<String>>::new(&Declaration::new("references"));
plugin.on::<Reference>(|reference, result| {
    result.push(reference.0.clone());
    Ok(())
})?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
let extractor = Extractor::new(&builder.build()?);
let document = Document {
    source: String::new(),
    children: vec![Node::leaf(Span { start: 0, end: 0 }, Reference("id".into()))],
};
assert_eq!(extractor.extract(&document)?, ["id"]);
# Ok::<(), &'static str>(())
```

The result type must implement `Default`; every call gets a new result. Handlers
are `Send + Sync` and are shared by extractors built from a preset, but the
result type does not need `Clone`, `Send`, or `Sync`.

Plugins are snapshot-based. Adding, removing, or editing a plugin never changes
an existing builder, preset, or extractor. Duplicate handlers are rejected.

`extract` validates the whole tree and visits every node in document order
(parent, descendants, next sibling). Unhandled nodes are still validated and
traversed. The default validation limits are 65,536 source bytes, 8 MiB of payload, 16,384 nodes,
and depth 64. Handlers own the limits of their work and result sizes.

Use `extract_validated(ValidatedDocument)` to avoid repeating validation when
sharing an immutable document with other consumers. It still creates a fresh
result and traverses all nodes.
