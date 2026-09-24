# markdown-trap-contracts

Defines the five traQ payload types—`ReferenceData`, `StampData`,
`EmbeddingData`, `SpoilerData`, and `BlankLineData`—plus their supporting types.
It does not depend on parser, renderer, or codec implementations.

`preset()` returns shared declarations for reference, stamp, spoiler, and
compatibility plugins. Parser, renderer, and extractor implementations use those
same declaration instances, while grammar and rendering presets choose their
actual implementations separately.

The `node_catalog!` macro is the single source for stable wire kinds, such as
`traq.stamp`, and for contract export. Each payload owns its `NodeData`
validation and serde representation. The optional `contracts` feature supports
TypeScript type and JSON Schema generation.
