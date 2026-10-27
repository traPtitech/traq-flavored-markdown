# markdown-extensions-syntax

Provides independent plugins for math, tables, strikethrough, mark, and
linkification. Add or remove each module's `plugin()` from a `GrammarBuilder`;
the caller chooses its order relative to CommonMark rules.

The extensions contracts crate owns extension node types, and the CommonMark
contracts crate owns the link and text nodes. Delimiter and URL handling reuse
CommonMark helpers. This crate has no traQ-specific syntax dependency.

The linkify plugin only extends angle-bracket autolinks: `<trap.jp>` and
`<//trap.jp>` target `https://trap.jp`, while `<README.md>` targets
`https://readme.md`. Labels retain their spelling inside the brackets. Any
syntactically valid dotted domain is eligible, without a TLD allowlist.
CommonMark URI and email autolinks keep their existing interpretation. Bare
domains, URLs, and email addresses remain text, including `https://trap.jp`
and `info@trap.jp`. Explicit Markdown link destinations are not completed.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms and data.
