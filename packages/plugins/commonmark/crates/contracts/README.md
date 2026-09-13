# markdown-commonmark-contracts

Defines the 17 CommonMark node types, their `NodeData` validation, serde
representations, and `NodeType` metadata. It does not depend on parser,
renderer, or codec implementations.

`#[derive(NodeType)]` provides transport metadata. A distribution registers the
types it ships, for example `codec.register::<Heading>()?`; this crate does not
maintain a node catalog or contract version.

`preset().plugin` and `preset().html` return the shared parser and renderer
declarations. Each is created once under the CommonMark group, so consumers of
the same contract use the same declaration instance. The declarations describe
identity and display names only; they do not select grammar rules or rendering
policy. This lets a CommonMark and a traQ-compatible composition share node
types.
