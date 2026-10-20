# Markdown extensions

This owner supplies optional math, table, mark, strikethrough, and linkify
features. It is separate from CommonMark and from the traQ display profile.

| Crate                        | Purpose                         |
| ---------------------------- | ------------------------------- |
| `markdown-generic-contracts` | Typed extension node payloads   |
| `markdown-generic-syntax`    | Optional syntax implementations |
| `markdown-generic-text`      | Plain-text handlers             |

The TypeScript package `@traq-flavored-markdown/extensions-plugin` exports
`/nodes`, `/renderer`, and `/math`. `plugin({ math })` registers typed HTML
handlers. Without a math adapter it preserves escaped source. `/math` supplies
the optional KaTeX adapter; node-only and custom-renderer consumers do not need
to load it.

Table column alignments belong to the table. Header rows and body rows are
distinct node kinds, and cells derive their presentation from the table and
their sibling index. Table, row, and cell handlers all use the core dispatcher,
so ancestry, handler replacement, omission, and child text replacement follow
the same rules as other nodes.

The wire namespace remains `generic.*`; node identities are independent of
their package paths. The SDK chooses the feature set and grammar precedence.
