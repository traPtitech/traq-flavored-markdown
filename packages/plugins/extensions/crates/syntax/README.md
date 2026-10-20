# markdown-generic-syntax

Provides independent plugins for math, tables, strikethrough, mark, and
linkification. Add or remove each module's `plugin()` from a `GrammarBuilder`;
the caller chooses its order relative to CommonMark rules.

The generic contracts crate owns extension node types, and the CommonMark
contracts crate owns the link and text nodes. Delimiter and URL handling reuse
CommonMark helpers. This crate has no traQ-specific syntax dependency.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms and data.
