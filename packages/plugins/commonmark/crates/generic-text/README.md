# markdown-generic-text

Plain-text renderer plugins for math, tables, mark, and strikethrough. The crate
depends only on renderer core and the corresponding node contracts, not on a
parser or a traQ implementation.

Add `math::plugin()`, `table::plugin()`, `mark::plugin()`, or
`strikethrough::plugin()` to a `PresetBuilder`. The factories return shareable
plugins by value; callers do not need to clone them. Use `Plugin::replace` to
customize a handler for one plugin instance.

Math renders its TeX source, tables render cells separated by `|` and rows with
a trailing newline, and decorations render their children. Linkify produces
CommonMark `Link` nodes and therefore needs no renderer plugin of its own.
