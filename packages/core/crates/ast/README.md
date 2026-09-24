# markdown-ast

A typed, grammar-independent AST. Node data and validation belong to the
contract crate that owns the data type. This crate uses only the standard
library: it has no CommonMark types, serde dependency, or contract registry.

```rust
use markdown_ast::{Node, NodeData, Span};

#[derive(Debug, Clone, PartialEq)]
struct Heading { level: u8 }

impl NodeData for Heading {
    fn validate(&self, _children: &[Node]) -> bool {
        (1..=6).contains(&self.level)
    }
}

let node = Node::leaf(Span { start: 0, end: 4 }, Heading { level: 2 });
assert_eq!(node.get::<Heading>().unwrap().level, 2);
assert!(node.validate());
```

`Node::new(span, data, children)` accepts a concrete data type. `NodeKind` holds
type-erased data while a parser is still determining children and positions.
`node.get::<T>()` borrows the stored value without copying or serializing it.
Adding a node type never requires a core enum change.

## Validation

`NodeData::validate` checks a node and its direct children. Use
`document.validate(limits)` for a complete tree check: it validates source size,
node count, depth, UTF-8 spans, containment, source-ordered non-overlapping
siblings, and every node's data. The default
limits are 65,536 source bytes, 16,384 nodes, and depth 64. Validation returns a
`ValidationError` on failure and never checks codec registrations or handlers.

AST construction and editing do not validate automatically. Validation is not
cached, so validate again after an edit. `ValidatedDocument::new(&document)` can
share one successful validation across immutable renderer and extractor borrows;
it neither copies nor persists the AST. Consumers still enforce their own codec,
handler, and output rules.

`Node` and `Document` implement `Clone`, `PartialEq`, `Send`, and `Sync`. They do
not promise `Eq`, since a payload may contain values such as `NaN`. JSON is the
responsibility of `markdown-codec`; the AST types do not implement
`Serialize`/`Deserialize`.
