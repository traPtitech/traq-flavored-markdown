# markdown-ast

A typed, grammar-independent AST. Node data and validation belong to the
contract crate that owns the data type. This crate uses only the standard
library: it has no CommonMark types, serde dependency, or contract registry.

```rust
use markdown_ast::{Node, NodeData, NodeRole, Span};

#[derive(Debug, Clone, PartialEq)]
struct Heading { level: u8 }

impl NodeData for Heading {
    fn structure() -> &'static markdown_ast::NodeStructure {
        static STRUCTURE: markdown_ast::NodeStructure = markdown_ast::NodeStructure {
            role: NodeRole::Block, children: markdown_ast::ChildStructure::Any,
        };
        &STRUCTURE
    }
    fn payload_bytes(&self) -> usize { 0 }
    fn validate_payload(&self, _children: &[Node]) -> Result<(), markdown_ast::PayloadError> {
        let valid = (|| {
        (1..=6).contains(&self.level)
    })();
        if valid { Ok(()) } else { Err(markdown_ast::PayloadError::new("custom payload invariant")) }
    }
}

let node = Node::leaf(Span { start: 0, end: 4 }, Heading { level: 2 });
assert_eq!(node.get::<Heading>().unwrap().level, 2);
assert!(node.validate().is_ok());
```

`Node::new(span, data, children)` accepts a concrete data type. `NodeKind` holds
type-erased data while a parser is still determining children and positions.
`node.get::<T>()` borrows the stored value without copying or serializing it.
Adding a node type never requires a core enum change.

`SourceText::new(&source)` borrows the original UTF-8 text. Its `slice(span)`
and `replace(&edits)` methods use checked byte offsets and preserve BOM, CRLF,
NUL, and all other untouched bytes. `SourceEdit` ranges must be ordered and
disjoint; processors that prefer outer edits select those ranges before calling
this helper. `replace_with_limit(&edits, bytes)` checks every range and the
complete output size before allocating the result.

## Validation

Every external plugin node must implement `NodeData::structure` and
`NodeData::payload_bytes`. A role declares block, inline, structural, or opaque
placement; existing parent contracts accept external nodes according to that
declaration without registering their types in core. `payload_bytes` counts
owned heap content, including every string field. `NodeData::validate` checks a node and
its direct children. Use `document.validate(limits)` for a complete tree check:
it validates source and payload size, node count, depth, UTF-8 spans,
containment, source-ordered non-overlapping siblings, and every node's data. The
default limits are 65,536 source bytes, 8 MiB of payload bytes, 16,384 nodes,
and depth 64. Validation returns a `ValidationError` on failure and never checks
codec registrations or handlers.

AST construction and editing do not validate automatically. Validation is not
cached, so validate again after an edit. `ValidatedDocument::new(&document)` uses
the default limits; `ValidatedDocument::with_limits(&document, limits)` carries
a successful check with the limits chosen by a parser or codec. Either can
share one validation across immutable renderer and extractor borrows without
copying or persisting the AST. Consumers still enforce their own codec, handler,
and output rules.

`Node` and `Document` implement `Clone`, `PartialEq`, `Send`, and `Sync`. They do
not promise `Eq`, since a payload may contain values such as `NaN`. JSON is the
responsibility of `markdown-codec`; the AST types do not implement
`Serialize`/`Deserialize`.
