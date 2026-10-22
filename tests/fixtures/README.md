# CommonMark fixtures

Unmodified 652 examples from John MacFarlane’s [CommonMark 0.31.2 specification](https://spec.commonmark.org/0.31.2/spec.json), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). SHA-256: `d431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20`.

`source-spans.json` defines the source byte contract shared by Rust, TypeScript,
and Go: BOM preservation, UTF-8 boundaries, slices, and disjoint edits.

`document-structure.json` defines accepted and rejected SDK document shapes.
All entries have valid UTF-8 spans so failures isolate payload and child contracts:
leaf nodes, inline roles, list items, table headers and column widths. Pure
TypeScript validation, native Wasm operations, and Go decoding consume
the same JSON.
