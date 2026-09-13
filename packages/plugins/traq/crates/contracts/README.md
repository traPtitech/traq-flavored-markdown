# markdown-trap-contracts

Defines the four traP payload types—`ReferenceData`, `StampData`, `SpoilerData`,
and `BlankLineData`—plus `ReferenceKind`. It does not depend on parser, renderer,
or codec implementations.

`preset()` returns shared declarations for reference, stamp, spoiler, and
compatibility plugins. Parser, renderer, and extractor implementations use those
same declaration instances, while grammar and rendering presets choose their
actual implementations separately.

The package preserves the existing payload shapes and validation. Stamps remain
`literal` values; syntax, rendering, notification classification, and URL
semantics belong elsewhere. The optional `contracts` feature supports existing
TypeScript type and JSON Schema generation.

Generated keys, such as `markdown_trap_contracts::stamp::StampData`, identify
the defining Rust type. They do not promise AST compatibility with a future
different definition.
