# Public test fixtures

- `traq-v1-commonmark.json`: fixed block and inline AST expectations for those
  inputs under the traQ V1 preset, captured on 2026-09-06 from the implementation
  previously checked against the prototype. This adaptation of the examples is
  also provided under CC BY-SA 4.0. It is a compatibility oracle, not the
  CommonMark HTML oracle.
- `traq-v1-extensions.json`: 21 synthetic inputs covering traQ and generic
  extensions, their opaque code contexts, malformed syntax, tabs and Unicode.

These fixtures contain no production messages. They allow tests to run without
the prototype, an application checkout, private corpora, or network access.
Expected ASTs are checked in as readable JSON. Changes to the accepted syntax
must be reviewed together with the fixture diff; ordinary builds never regenerate
expectations from the parser under test.

On 2026-09-08 the fixed AST expectations were mechanically converted to the
current structure: payload fields moved into `data`, and legacy kind/name pairs became
generated type keys. Source, payload values, spans, children and parse errors
were preserved. The new parser was compared against these converted snapshots;
it was not used to generate replacement expectations.

- `processing-plain-text.json`: 787 frozen plain-text expectations imported
  mechanically on 2026-09-08 from the previous shared-backend prototype: 60
  synthetic cases and 727 public compatibility cases, including 652 CommonMark
  inputs and Markdown/traQ regressions. Only names, input and
  existing plain-text expectations were copied; the new pipeline did not
  regenerate them. CommonMark-derived cases remain CC BY-SA 4.0 under the
  [root fixture attribution](../../../../tests/fixtures/README.md). Other algorithm/fixture attribution is recorded in
  `THIRD_PARTY_NOTICES.md`. The origin for these expectations is
  `https://q.example.test`. Native Rust, Go and TypeScript all run this corpus.

On 2026-10-04, the unreleased traQ V1 grammar adopted CommonMark image parsing.
Reviewed AST changes cover CommonMark examples 517, 520, 531, 572, 574, 575,
578, 579, 580, and 581, plus the synthetic `images` case. Images now retain
their destination, title, label source, and children as image nodes; enclosing
links follow the CommonMark bracket rules. The corresponding plain-text
expectations (`public-517` through the listed examples, and `public-668`) render
image labels through the existing image handler. Inputs and all unrelated
expectations were retained. Empty quotes and URL presentation policy are tested
separately by focused grammar and renderer tests.

The same 2026-10-04 contract revision mechanically migrated list and table
payloads from those frozen expectations. List marker spelling was read from the
existing items and moved to the list's tagged `kind`; table alignment was read
from the existing cells and moved to the table, with the first row becoming
`generic.table_header_row`. Redundant item, row, and cell fields were removed.
This changed 80 CommonMark records and two extension records: 106 lists, 157
list items, one table, two rows, and four cells. The independently transformed
expectations matched the revised parser in both modes, with no other AST
differences and all 787 plain-text expectations unchanged. Sources, spans, and
child order were preserved.

On 2026-10-23, the unreleased code-block payload made `info` a semantic string:
CommonMark backslash escapes and character references are decoded while parsing,
so every renderer sees the same language name. The two block expectations for
CommonMark examples 24 and 34 were reviewed against the independent specification
HTML (`language-foo+bar` and `language-föö`) in the root fixture and edited by hand.
Source text, spans, literal code, inline-mode expectations, and every other
expectation are unchanged. No parser output was used to regenerate this fixture.
