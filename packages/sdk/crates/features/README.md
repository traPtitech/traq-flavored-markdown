# traq-markdown-features

This SDK assembly layer joins each feature's shared declaration, native payload
types, plugin-owned wire keys, exported SDK member, syntax implementation, and
text implementation. `all()` exposes these capabilities. Profile definitions
own their ordered feature lists and typed rule precedence together;
`selected(profile)` returns the selected capabilities in registration order.

The default build depends only on AST, definitions, and payload contract crates.
Enable `syntax` for grammar assembly or `text` for plain-text assembly. Syntax
does not require a renderer, and text does not require a parser. Contracts never
depend on this SDK crate or its implementations.

`Profile::grammar_builder()` assembles syntax from the profile definition.
Processing presets retain application-specific link and reference overrides.
Feature factories select implementations without owning profile policy. Both native grammar
presets reuse `commonmark_syntax()` so their shared rule identities agree with
the exported catalog.

When adding a feature, add its implementation in the owning plugin and one table
entry here, then select it in the relevant profile definition. The feature table
drives SDK catalog members independently of profile membership.
Its coverage test compares native payload identities and wire keys with all
plugin-owned catalogs, rejecting missing and duplicate bindings.
