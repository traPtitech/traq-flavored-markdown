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
assert_eq!(node.payload::<Heading>().unwrap().level, 2);
assert!(node.validate().is_ok());
```

`Node::new(span, data, children)` accepts a concrete data type. `AnyPayload` holds
type-erased data while a parser is still determining children and positions.
`node.payload::<T>()` borrows the stored value without copying or serializing it.
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
declaration without registering their types in core. Deliberately unrestricted
opaque nodes explicitly return `NodeStructure::opaque()` from their structure
implementation. `payload_bytes` counts logical dynamic payload content:
UTF-8 string bytes, populated collection storage, boxed values, and their nested
dynamic fields. `PayloadFields::dynamic_payload_bytes` supplies that field
accounting. Spare capacity and allocator overhead are excluded; this budget
does not bound retained allocator memory. `NodeData::validate_payload` checks a
node and its direct children. Use `document.validate(limits)` for a complete tree check:
it validates source and payload size, node count, depth, UTF-8 spans,
containment, source-ordered non-overlapping siblings, and every node's data. The
default limits are 65,536 source bytes, 8 MiB of payload bytes, 16,384 nodes,
and depth 64. Validation returns a `ValidationError` on failure and never checks
codec registrations or handlers. The structure contract is always checked before
the custom `validate_payload` hook, so a custom validator cannot bypass it.
The `markdown_definitions::node` attribute derives the ordinary implementation
and field accounting; `markdown_definitions::payload` handles nested data.

Use `MutableDocument { source, children }` while constructing or editing a tree.
`finish()` or `finish_with_limits(limits)` checks it and returns an immutable
`Document`. Parsers and codecs return this checked owner by default. Its
`as_view()` borrows a copyable `DocumentView` carrying the existing validation
facts; repeated consumers do not rerun payload validation. `into_mutable()`
consumes the owner to begin another edit and discards those facts.

Consumer methods have one `DocumentInput` entry point. Passing `&Document` or
`DocumentView` reuses the proof. Passing `&MutableDocument` explicitly crosses
the validation boundary, with default limits, before handlers run. To select
custom limits for a draft, call `validate(limits)` and pass the returned view.
Consumers still enforce codec registrations, handler support, and output limits.

`Node`, `MutableDocument`, and `Document` implement `Clone`, `PartialEq`,
`Send`, and `Sync`. They do not promise `Eq`, since a payload may contain
values such as `NaN`. JSON belongs to `markdown-codec`; AST types do not
implement `Serialize`/`Deserialize`.
