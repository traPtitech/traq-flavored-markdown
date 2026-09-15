# traQ processing presets

Composes plain-text rendering and reference extraction for traQ. The crate
does not normally depend on a parser or codec: implementations are supplied by
`commonmark-text`, `generic-text`, `trap-text`, and `trap-extraction` and consume
the native AST directly.

```rust
use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq;

let renderer = Renderer::new(&traq::plain_text::preset("https://q.example.test")?);
let extractor = Extractor::new(&traq::references::preset()?);
let validated = markdown_ast::ValidatedDocument::new(&document)?;
let text = renderer.render_validated(validated)?;
let references = extractor.extract_validated(validated)?;
```

Run the full example with `cargo run -p traq-markdown-processing --example
plain_text` from the repository root. It passes an AST directly between
consumers and serializes only the final result.

## Configure a preset

`plain_text::builder(origin)` and `references::builder()` return editable
builders. After adding or removing plugins, call `build()` and pass the preset to
the generic renderer or extractor. Existing runtime instances retain their own
configuration.

Plain-text output normalizes all whitespace runs to one space. Spoilers retain
newlines while they are rendered, then mask other Unicode scalar values with
`█`. `origin` may be empty to disable special attachment and citation display;
otherwise it is limited to 2,048 UTF-8 bytes. Exact `/files/{uuid}` and
`/messages/{uuid}` URLs below that origin are recognized after removing a query
or fragment. UUIDs normalize to lowercase. Other paths and URLs requiring
normalization are ordinary links.

## Extraction and embeddings

Reference extraction returns normalized user, group, and channel IDs while
preserving order, duplicates, and references inside spoilers. Code text does not
produce reference nodes. `message::Extractor` also produces source-preserving
message text, attachment IDs, citation IDs, and an embedding plan. It preserves
explicit Markdown links, and excludes code and math strings from attachment and
citation discovery. Identity lookup and notification delivery remain application
responsibilities.

`embedding::plan(&document)` identifies references in recognized ordinary text;
it does not create new references in code, math, links, images, or existing
embeddings. Candidate spans are UTF-8 byte offsets in the original source.
Pass the plan and an application name resolver to `EmbedReferences` (Go) or
`embedReferences` (TypeScript) to replace only resolved ranges. Use
`embedding.unembeddedText` to restore labels for copying and `mentionsUser` on
the parsed references for mention checks.

The public Rust APIs are `extraction::Extractor::extract(&Document)` and
`rendering::PlainTextRenderer::render(&Document)`. They do not select grammars
or reparse source. `extract_validated` and `render_validated` can share one
immutable AST validation. Source replacement is applied by span order: an outer
replacement wins for equal or nested spans, while crossing spans are rejected.
