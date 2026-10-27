# Renderer fixtures

The CommonMark fixtures are shared from the [root fixture directory](../../../../../../tests/fixtures/README.md).

`renderer-corpus-regressions.json` contains synthetic, minimal examples of
rendering regressions found while comparing private corpus messages.
These examples contain no original message text or identifiers. Their expected
HTML for the blank-line cases was verified against the Token-based renderer at
`778285e`, using the same Rust parser as the direct HTML renderer. The list
structure cases were checked against CommonMark 0.31.2's reference implementation
and the legacy traQ renderer.

The cases cover blank-line nodes after paragraphs in tight bullet, ordered, and
nested lists, consecutive blank-line nodes, and a loose-list control. They also
cover lazy quote continuations, ordered lists ending quotes, and tight lists
containing code between paragraphs. They run with `bun test`; the private corpus
is not required.
