# CommonMark crates

These crates implement CommonMark contracts, syntax, and plain-text rendering.

| Directory                  | Package                         | Purpose                                        |
| -------------------------- | ------------------------------- | ---------------------------------------------- |
| `contracts`                | `markdown-commonmark-contracts` | CommonMark nodes, validation, and declarations |
| [syntax](syntax/README.md) | `markdown-commonmark`           | CommonMark parsing rules and HTML syntax       |
| [text](text/README.md)     | `markdown-commonmark-text`      | CommonMark plain-text rendering                |

Optional math, table, mark, strikethrough, and linkify implementations belong to
the separate [extensions owner](../../extensions/README.md).

Syntax and rendering share node contracts. A consumer's `GrammarBuilder`
chooses which plugins form a grammar, so an exact CommonMark composition remains
possible. This family depends on core and does not include traQ profile policy.
