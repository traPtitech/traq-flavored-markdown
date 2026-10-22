# markdown-generic-contracts

Defines the seven node types used by the generic Markdown extensions: math,
tables, mark, and strikethrough. It does not depend on parser, renderer, or
codec implementations.

`preset()` returns shared declarations for the math, table, mark,
strikethrough, and linkify plugins. Grammars and rendering presets select and
order their implementations separately. Linkify reuses CommonMark `Link` and
`Text` nodes, so it has no dedicated payload type.

Each payload owns its `NodeData` validation and serde representation. The
`node_catalog!` macro is the single source for its stable wire kind, such as
`generic.inline_math`, and for contract export. The optional `contracts` feature
supports TypeScript type and JSON Schema generation; the standard Wasm
distribution does not require it.
