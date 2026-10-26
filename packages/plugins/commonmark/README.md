# CommonMark plugin

This package provides CommonMark 0.31.2. It
owns its grammar, node contracts, and plain-text rendering, while the SDK
chooses which plugins form the traQ presets.

| Crate                           | Purpose                         |
| ------------------------------- | ------------------------------- |
| `markdown-commonmark-contracts` | Typed CommonMark nodes          |
| `markdown-commonmark`           | CommonMark syntax               |
| `markdown-commonmark-text`      | CommonMark plain-text rendering |

The crates can be used independently. Contract and syntax crates live together,
but a consumer that only reads nodes does not need a parser implementation.
Tables, math, mark, strikethrough, and linkify belong to the separate
[extensions owner](../extensions/README.md).

## Boundaries

This package depends on core and does not know about traP syntax, traQ presets,
or application policy. Those responsibilities belong to the traQ plugin and SDK.

The TypeScript package exports generated node types and HTML renderers.
`plugin(options)` creates immutable CommonMark handlers. `createHtmlRenderer(options)` returns
a renderer that escapes raw HTML and applies the safe link and image policies
below. `createSpecHtmlRenderer(options)` returns a renderer for the CommonMark 0.31.2 HTML
specified by the 652 examples, including raw HTML, XHTML-style void tags, and
links with arbitrary valid schemes. **Do not render untrusted Markdown with
`createSpecHtmlRenderer()`**: specification HTML can contain executable markup and URLs.
Use `createHtmlPreset(options)` or `createSpecHtmlPreset(options)` when composing handlers
with the core `createRenderer()` function. A composed renderer such as the SDK passes
its display policy explicitly to `plugin(options)`. The Go
module is `github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go`;
its payloads and node factories are generated from these Rust contracts. The
shared AST and Wasm runtime remain in the core Go module.

The `createHtmlRenderer(options)` link policy accepts relative URLs and the `http`, `https`,
`mailto`, `ftp`, `tel`, `sms`, and `geo` schemes. Images accept relative, `http`,
and `https` URLs. A rejected link renders as escaped Markdown source, so its
destination and any autolink angle brackets remain visible. Hosts can override
these defaults with `validateLink` and `validateImage`.

Images retain their enclosing link whether the image is displayed or rejected.
For `[![alt](image-url)](page-url)`, an allowed image renders inside the link to
`page-url`. A rejected image renders as the plain label `!alt` inside that same
link, without a nested anchor or a request for `image-url`. The link policy checks
`page-url`; `image-url` does not need to pass the link policy when it is only
replaced with text. Direct and reference images follow the same rules.
A rejected standalone image becomes a link to its image URL prefixed with `!`
when that URL passes the link policy; otherwise the escaped Markdown source
remains visible. Rejected enclosing links also retain their escaped source.

A custom `highlight` callback returns `{ kind: 'content', html }` for HTML to
place inside `<code>`, `{ kind: 'block', html }` for a complete `<pre>` block, or
`undefined` to use escaped source.
An empty `html` string is an explicit result. The optional
`@traq-flavored-markdown/commonmark-plugin/highlight` adapter exposes
`createHighlighter({ preClass, caption, autoLanguages })`; importing node
contracts does not load that adapter. `highlight.js` is an optional peer dependency:
install it only when using `/highlight`. The generic URL helpers are exported from
`@traq-flavored-markdown/core/html`. Generated `/nodes` exports a standalone
`schema`; provide it to `createRenderer(preset, { schema })` when rendering raw trees.

Attribution and licensing for the 652 CommonMark examples are in the
[shared fixtures](../../../tests/fixtures/README.md).
