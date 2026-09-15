# markdown-commonmark-text

Plain-text renderer plugins for CommonMark ASTs. They do not depend on the
CommonMark parser or traQ implementation. `plugin()` handles ordinary nodes and
`html::plugin()` handles HTML nodes.

Links render their labels, code renders its content, and lists include their
markers. HTML node contents are returned as text, so a consumer that passes the
result to an HTML sink is responsible for escaping it.

Use `plugin_with_options()` with
`ExplicitLinkStyle::LabelAndDestination` to render explicit links as
`[label](destination)`.

```rust
use markdown_commonmark_contracts::Link;
use markdown_commonmark_text as commonmark;
use markdown_renderer::{PresetBuilder, Renderer};

let mut plugin = commonmark::plugin();
plugin.replace::<Link>(|link, _, _| Ok(link.destination.clone()))?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
builder.add(&commonmark::html::plugin())?;
let renderer = Renderer::new(&builder.build()?);
# Ok::<(), &'static str>(())
```

Factories return shared plugin snapshots by value. Replacing a handler changes
only that returned plugin; it does not affect future factory calls or existing
presets. Paragraph boundaries are preserved. Notification-specific whitespace
normalization and delivery belong to higher-level processing.
