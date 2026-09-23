# CommonMark plugin

This package provides CommonMark 0.31.2 and reusable Markdown extensions. It
owns their grammar, node contracts, and plain-text rendering, while the SDK
chooses which plugins form the traQ presets.

| Crate                           | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `markdown-commonmark-contracts` | Typed CommonMark nodes                          |
| `markdown-commonmark`           | CommonMark syntax                               |
| `markdown-commonmark-text`      | CommonMark plain-text rendering                 |
| `markdown-generic-contracts`    | Nodes for math, tables, strikethrough, and mark |
| `markdown-generic-syntax`       | Reusable extension syntax                       |
| `markdown-generic-text`         | Reusable extension plain-text rendering         |

The crates can be used independently. Contract and syntax crates live together,
but a consumer that only reads nodes does not need a parser implementation.

## Boundaries

This package depends on core and does not know about traP syntax, traQ presets,
or application policy. Those responsibilities belong to the traQ plugin and SDK.

The TypeScript package exports generated node types and HTML renderers.
`plugin(options)` and `specHtml(options)` produce the CommonMark 0.31.2 HTML
specified by the 652 examples, including raw HTML, XHTML-style void tags, and
links with arbitrary valid schemes. **Do not render untrusted Markdown with
these defaults**: specification HTML can contain executable markup and URLs.
`html(options)` is a display preset that escapes raw HTML and applies the safe
link and image policies below. A composed renderer such as the SDK passes its
display policy explicitly to `plugin(options)`. The Go
module is `github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go`;
its payloads and node factories are generated from these Rust contracts. The
shared AST and Wasm runtime remain in the core Go module.

The `html(options)` link policy accepts relative URLs and the `http`, `https`,
`mailto`, `ftp`, `tel`, `sms`, and `geo` schemes. Images accept relative, `http`,
and `https` URLs. A rejected link renders as escaped Markdown source, so its
destination and any autolink angle brackets remain visible. Hosts can override
these defaults with `validateLink` and `validateImage`.

Attribution and licensing for the 652 CommonMark examples are in the
[shared fixtures](../../../tests/fixtures/README.md).
