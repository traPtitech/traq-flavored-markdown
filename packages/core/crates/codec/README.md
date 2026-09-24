# markdown-codec

The JSON transport for typed ASTs. Register the contract types used by a
distribution, then reuse the codec to encode and decode documents:

```rust
codec.register::<List>()?;
let json = codec.encode(&document)?;
let document = codec.decode(&json)?;
# Ok::<(), Box<dyn std::error::Error>>(())
```

Core has no fixed list of node types. A registered type implements `NodeData`,
`NodeType`, `Serialize`, and `DeserializeOwned`; `#[derive(NodeType)]` generates
its transport metadata. Plugins and explicit contract-version IDs are not part
of registration.

## Format and validation

Documents use `{ source, children }`; nodes use `{ kind, span, data, children }`.
Empty `children` are omitted. Payload data is serialized directly from its
contract type.

Decoding selects a registered concrete type from `kind`, then validates it and
the complete tree. It rejects unknown contracts, unknown or duplicate wrapper
fields, duplicate registrations, and invalid source positions. Payload field
handling is defined by the payload's serde implementation. Failed registration
does not change existing registrations, and registered keys are reused instead
of regenerated for every node.

## Compatibility and limits

AST JSON is an intermediate exchange format, not a persistent compatibility
format. Producers and consumers must share compatible definitions and generated
bindings; matching type keys alone do not guarantee payload compatibility.

Default limits are 8 MiB of JSON, 65,536 source bytes, 16,384 nodes, and depth 64. Encoding validates type, position, and resource limits too.
The tree limits come from `markdown_ast::ValidationLimits`; `CodecLimits`
adds the JSON byte limit. `encode_with_limits` and `decode_with_limits` accept
the same explicit limits when a producer uses a larger tree budget. The
`DecodeLimits` name remains an alias for `CodecLimits`.
Grammar selection and parser or
renderer lifecycle management are outside this crate.
