# CommonMark and generic extension crates

These independently published crates implement CommonMark and reusable Markdown
extensions such as math, tables, and linkification.

| Directory                  | Package                         | Purpose                                             |
| -------------------------- | ------------------------------- | --------------------------------------------------- |
| `contracts`                | `markdown-commonmark-contracts` | CommonMark nodes, validation, and declarations      |
| [syntax](syntax/README.md) | `markdown-commonmark`           | CommonMark parsing rules and HTML syntax            |
| [text](text/README.md)     | `markdown-commonmark-text`      | CommonMark plain-text rendering                     |
| `generic-contracts`        | `markdown-generic-contracts`    | Generic extension nodes                             |
| `generic-syntax`           | `markdown-generic-syntax`       | Math, table, mark, strikethrough, and linkify rules |
| `generic-text`             | `markdown-generic-text`         | Generic extension plain-text rendering              |

Syntax and rendering share node contracts, not implementation dependencies. A
consumer's `GrammarBuilder` chooses which plugins form a grammar, so an exact
CommonMark composition remains possible. This family depends on core, never on
traP extensions or traQ presets.
