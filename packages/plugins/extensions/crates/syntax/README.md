# markdown-extensions-syntax

Provides independent plugins for math, tables, strikethrough, mark, and
linkification. Add or remove each module's `plugin()` from a `GrammarBuilder`;
the caller chooses its order relative to CommonMark rules.

The extensions contracts crate owns extension node types, and the CommonMark
contracts crate owns the link and text nodes. Delimiter and URL handling reuse
CommonMark helpers. This crate has no traQ-specific syntax dependency.

The linkify plugin recognizes bare email addresses and `http://`, `https://`, `ftp://`, and `//` URLs,
including local hosts and IP addresses, and extends angle-bracket autolinks: `<trap.jp>` and
`<//trap.jp>` target `https://trap.jp`, while `<README.md>` targets
`https://readme.md`. Labels retain their spelling inside the brackets. Any
syntactically valid dotted domain is eligible, without a TLD allowlist.
CommonMark URI and email autolinks keep their existing interpretation. Bare
domains remain text, including `trap.jp`. Bare `//` URLs target HTTPS and retain
the written `//` in their label. They require a dotted host or an IPv6 literal;
single-label strings such as `//TODO` remain text. Bare email addresses require an ASCII local part and a dotted
ASCII domain; their TLD is unrestricted. `info@trap.jp` targets
`mailto:info@trap.jp`, and a written `mailto:` prefix is retained. A leading
`@` without a local part, such as `@gmai.com`, remains text. Other URI schemes
require angle brackets or explicit Markdown links. Explicit Markdown link
destinations are not completed.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms and data.
