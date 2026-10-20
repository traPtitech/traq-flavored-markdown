# traq-markdown-features

This SDK assembly layer joins each feature's shared declaration, native payload
types, plugin-owned wire keys, exported SDK member, syntax implementation, text
implementation, and standard profile selections. `all()` exposes the table;
`selected(profile)` returns its entries in profile registration order.

The default build depends only on AST, definitions, and payload contract crates.
Enable `syntax` for grammar assembly or `text` for plain-text assembly. Syntax
does not require a renderer, and text does not require a parser. Contracts never
depend on this SDK crate or its implementations.

The grammar presets retain typed rule precedence. Processing presets retain
application-specific link and reference overrides. Feature factories select
the implementations; they do not own those policies. Both native grammar
presets reuse `commonmark_syntax()` so their shared rule identities agree with
the exported catalog.

When adding a feature, add its implementation in the owning plugin and one table
entry here. The table drives SDK catalog members and default profile membership.
Its coverage test compares native payload identities and wire keys with all
plugin-owned catalogs, rejecting missing and duplicate bindings.
