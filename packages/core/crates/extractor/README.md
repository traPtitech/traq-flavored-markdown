# markdown-extractor

Collects information from a typed AST with typed handlers. It depends only on
the AST and shared declarations, not on a grammar, parser, renderer, codec, or
traQ-specific result type.

```rust
use markdown_ast::{MutableDocument, Node, NodeData, NodeRole, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_extractor::{Extractor, Plugin, PresetBuilder};

#[derive(Debug, Clone, PartialEq)]
struct Reference(String);
impl NodeData for Reference {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Inline, children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize { self.0.len() }
}

let mut plugin = Plugin::<Vec<String>>::new(&Declaration::new("references"));
plugin.on::<Reference>(|reference, _, result| {
    result.push(reference.0.clone());
    Ok(())
})?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
let extractor = Extractor::new(&builder.build()?);
let document = MutableDocument {
    source: String::new(),
    children: vec![Node::leaf(Span { start: 0, end: 0 }, Reference("id".into()))],
};
assert_eq!(extractor.extract(&document)?, ["id"]);
# Ok::<(), markdown_extractor::Error>(())
```

The result type must implement `Default`; every call gets a new result. Handlers
are `Send + Sync` and are shared by extractors built from a preset, but the
result type does not need `Clone`, `Send`, or `Sync`.

Plugins are snapshot-based. Adding, removing, or editing a plugin never changes
an existing builder, preset, or extractor. Duplicate handlers are rejected.
`register` returns a stable registration handle; `remove` consumes its identity
independently of later edits to the original plugin.

`extract` reuses a checked document or validates an editable draft before
visiting every node in document order
(parent, descendants, next sibling). Unhandled nodes are still validated and
traversed. The default validation limits are 65,536 source bytes, 8 MiB of payload, 16,384 nodes,
and depth 64. Handlers own the limits of their work and result sizes.

Use `extract(DocumentView)` to avoid repeating validation when
sharing an immutable document with other consumers. It still creates a fresh
result and traverses all nodes.

`Collector` describes scoped analyses, and `collect(document, &mut collector)`
runs them in source order. The callback receives `AnalysisContext` with the
node's source, parent, sibling index, and depth. Its returned scope is inherited
by descendants without leaking to siblings. Tuple collectors share one traversal.
`extractor.collector::<E>()` participates in the same composition and returns
its accumulated result through `finish()`; `E` converts extractor errors into
the enclosing analysis error type. Typed plugin handlers also receive this
context, so source-aware operations need no second extraction framework.
