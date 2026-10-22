# traq-markdown-grammar

The typed grammar distribution layer. It combines CommonMark, generic, and traP
extensions; their individual syntax crates own the rules themselves.

`traq-markdown-features` joins each feature's shared declaration, native payload
types, SDK export member, implementation factories, and profile membership.
The grammar presets and exported plugin catalog select entries from that table;
their typed rule precedence remains in this crate. Both native presets reuse
one CommonMark syntax instance. The `syntax` Cargo feature keeps this assembly
independent of renderer implementations.

```rust
use traq_markdown_grammar::{Parser, presets, syntax::extensions};

let parser = presets::traq::v1::parser();
let document = parser.parse("**hello** :stamp:")?;

let mut builder = presets::traq::v1::builder();
let math = builder.registration(extensions::math::plugin()).expect("preset math");
builder.remove(&math)?;
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
`traq_markdown_grammar::bindings::Catalog`. Distribution DTOs and JSON export
metadata live in this SDK layer. The core parser exposes typed registration and
checked rule ordering without depending on JSON catalogs.

Run the example with `cargo run -p traq-markdown-grammar --example parse`.
`bun run check:architecture` verifies the dependency direction and confirms that
native renderers and extractors do not use the AST codec.
