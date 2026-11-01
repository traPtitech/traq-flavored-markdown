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

Bare URL paths preserve balanced ASCII parentheses, including nested pairs in
Wikipedia-style URLs. An unmatched closing parenthesis immediately ends the URL,
even when prose follows it. Only parentheses inside the URL count; enclosing
prose parentheses are not included. If open brackets remain at the end of the
scan, the link ends before the first unmatched opener. Terminal `_` and `-` are
part of the URL, including in query strings and fragments. Other terminal punctuation follows
GFM trimming: trailing `? ! . , : * ~` and semicolons are outside the link;
interior punctuation, including `~` in `/~user/page`, is preserved.
These parenthesis and underscore rules deliberately differ from GFM.
Angle autolinks and explicit destinations preserve parentheses and terminal
punctuation; use `<https://example.test/a(b)~>` to state the complete URL,
`~~<https://example.test/a~>~~` for strikethrough, and `_<https://example.test/a_>_`
for emphasis. A preceding hyphen is accepted as a URL boundary, following
GitHub's current rendering behavior. Hostname validation is unchanged.
Both inline recognition and text fallback account for unclosed-bracket
lookahead against the parser work limit.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for notices covering
third-party algorithms and data.
