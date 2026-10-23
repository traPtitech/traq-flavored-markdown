# markdown-trap-text

Plain-text renderer plugins for traP nodes. They do not depend on parser or
extractor implementations.

Add `references::plugin()`, `stamp::plugin()`, `spoiler::plugin()`, or
`spacing::plugin()` to a `RenderPresetBuilder`. The factories return shareable plugins
by value; callers do not need to clone them. Use `RenderPlugin::replace` to customize
one handler.

References render their display labels, stamps render their literals, and
source-backed blank lines render as newlines. Spoilers replace every non-newline
character of rendered children with `█`. Notification delivery, URL
classification, and whitespace normalization are higher-level responsibilities.

For a composition example, run `cargo run -p traq-markdown-processing --example
compose-text` from the repository root.
