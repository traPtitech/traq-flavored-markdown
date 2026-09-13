# markdown-generic-contracts

Defines the seven node types used by the generic Markdown extensions: math,
tables, mark, and strikethrough. It does not depend on parser, renderer, or
codec implementations.

`preset()` returns shared declarations for the math, table, mark,
strikethrough, and linkify plugins. Grammars and rendering presets select and
order their implementations separately. Linkify reuses CommonMark `Link` and
`Text` nodes, so it has no dedicated payload type.

Each payload owns its `NodeData` validation, serde representation, and
`NodeType` metadata. The optional `contracts` feature is retained for existing
TypeScript type and JSON Schema generation; the standard Wasm distribution does
not require it.

Generated keys reflect the defining type, for example
`markdown_generic_contracts::math::InlineMathData`. They are not stable AST
persistence or grammar-version IDs.
