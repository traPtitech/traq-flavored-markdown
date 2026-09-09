# traq-markdown-grammar

型付き parser の文法配布層。CommonMark、汎用拡張、traP 拡張を組み合わせる。
ルール自身の実装は各 syntax crate にあり、ここでは preset と bindings 向け catalog を定義する。

```rust
use traq_markdown_grammar::{Parser, presets, syntax::extensions};

let parser = presets::traq::v1::parser();
let document = parser.parse("**hello** :stamp:")?;

// 既存の preset を元に、不要な拡張をインスタンスで取り除く。
let mut builder = presets::traq::v1::builder();
builder.remove(extensions::math::plugin())?;
let customized = Parser::new(&builder.build()?);
let inline = customized.parse_inline("$x$")?;
# Ok::<(), Box<dyn std::error::Error>>(())
```

`presets::commonmark` と `presets::traq::v1` が、再利用できる parser と grammar、
編集用 builder を提供する。将来の版は `traq::v2` のように追加する。
保存済み本文と文法版の対応付けは利用側の責務。

`bindings::bundled()` は配布物に収録する plugin と preset を列挙する。
この catalog は parser core に登録済みの全世界共通の一覧ではない。
別の配布物は `markdown_parser::bindings::Catalog` から構成できる。

[実行例](examples/parse.rs): `cargo run -p traq-markdown-grammar --example parse`

公開 TS / Go SDK の Wasm はこの配布層を利用し、AST 4 の共通形式で結果を受け取る。

`npm run check:architecture` で、処理プリセットと拡張部品の依存方向、
および ネイティブ renderer / extractor が AST codec を使わないことを検査する。
