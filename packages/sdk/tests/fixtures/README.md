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
