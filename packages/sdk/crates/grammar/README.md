# traq-markdown-grammar

The typed grammar distribution layer. It combines CommonMark, generic, and traP
extensions; their individual syntax crates own the rules themselves.

```rust
use traq_markdown_grammar::{Parser, presets, syntax::extensions};

let parser = presets::traq::v1::parser();
let document = parser.parse("**hello** :stamp:")?;

let mut builder = presets::traq::v1::builder();
builder.remove(extensions::math::plugin())?;
let customized = Parser::new(&builder.build()?);
let inline = customized.parse_inline("$x$")?;
# Ok::<(), Box<dyn std::error::Error>>(())
```

`presets::commonmark` and `presets::traq::v1` provide reusable parsers,
grammars, and editable builders. The application maps stored source to a grammar
version; future versions are added as new presets such as `traq::v2`.

`src/bindings/presets.rs` is the source of truth for grammar names,
implementations, and SDK export names. `bindings::grammar(name)` shares a cached
native grammar; `bindings::preset_exports()` reads metadata without compiling a
grammar. The public SDK derives its preset constants from this catalog.

`bindings::bundled()` is an editable catalog for distribution tooling, not a
global parser registry. Normal Wasm and SDK preset selection does not rebuild a
grammar through it. Other distributions can compose a catalog with
`markdown_parser::bindings::Catalog`.

Run the example with `cargo run -p traq-markdown-grammar --example parse`.
`bun run check:architecture` verifies the dependency direction and confirms that
native renderers and extractors do not use the AST codec.
