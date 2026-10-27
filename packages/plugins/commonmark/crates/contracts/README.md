# markdown-commonmark-contracts

Defines the 17 CommonMark node types, their `NodeData` validation, serde
representations, and `WireTypeKey` metadata. It does not depend on parser,
renderer, or codec implementations.

The `feature_catalog!` macro owns feature declarations, payload membership, and
stable wire keys. `node_catalog!` exposes the payload list for contract export.
A distribution registers the types it ships, for example
`codec.register::<Heading>()?`.

`declarations().plugin` and `declarations().html` return the shared parser and renderer
declarations. Each is created once under the CommonMark group, so consumers of
the same contract use the same declaration instance. The declarations describe
identity and display names only; they do not select grammar rules or rendering
policy. This lets a CommonMark and a traQ-compatible composition share node
types.
