# traq-markdown-features

This SDK assembly layer selects plugin-owned feature contracts and joins them
with exported SDK members and syntax factories. Each plugin owns one grouped
payload catalog, used for wire registrations and typed feature contracts.
Adding a payload does not require another list in the SDK.

GrammarProfile owns syntax feature order and typed rule precedence together.
grammar_features(profile) returns its features in registration order.
TextProfile selects TextFeature values; every such value has a plain-text
implementation. Grammar and text profiles are distinct types, so a rendering
profile cannot enter grammar construction and missing rendering capabilities
cannot reach an unwrap.

The default build depends on definitions and payload contract crates. Enable
syntax for grammar assembly or text for plain-text assembly. Syntax does not
require a renderer, and text does not require a parser. Contracts never depend
on this SDK crate or its implementations.

GrammarProfile::grammar_builder() assembles syntax. Processing presets retain
application-specific link and reference overrides. Both native grammar presets
reuse commonmark_syntax(), keeping shared rule identities consistent with the
exported catalog. Coverage tests reject missing or duplicate payload bindings.
