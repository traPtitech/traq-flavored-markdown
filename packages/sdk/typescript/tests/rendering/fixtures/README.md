# Renderer fixtures

The CommonMark fixtures are shared from the [root fixture directory](../../../../../../tests/fixtures/README.md).

`renderer-corpus-regressions.json` contains synthetic, minimal examples of a
rendering regression found while comparing 100,000 private corpus messages.
These examples contain no original message text or identifiers. Their expected
HTML was verified against the Token-based renderer at `778285e`, using the same
Rust parser as the direct HTML renderer.

The cases cover blank-line nodes after paragraphs in tight bullet, ordered, and
nested lists, consecutive blank-line nodes, and a loose-list control. They run
with `bun test`; the private corpus is not required.
