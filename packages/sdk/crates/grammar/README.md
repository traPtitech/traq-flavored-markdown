# traq-markdown-grammar

型付き parser の文法配布層。CommonMark、汎用拡張、traP 拡張を組み合わせる。
ルール自身の実装は各 syntax crate にあり、ここでは preset と文法名のレジストリを定義する。

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

`bindings::grammar(name)` は native preset のキャッシュ済み `grammar()` を共有し、同じ初期化処理を使う。
`src/bindings/presets.rs` の一覧が文法名・実装・SDK の export 名を所有する。
`bindings::preset_exports()` は文法をコンパイルせずに SDK メタデータを返す。

`bindings::bundled()` は編集可能な Catalog API として、配布物に収録する plugin と preset を列挙する。
この catalog は parser core に登録済みの全世界共通の一覧ではない。
別の配布物は `markdown_parser::bindings::Catalog` から構成できる。
通常の文法選択や Wasm / SDK メタデータ生成は Catalog / Composition による再構築を経由しない。

[実行例](examples/parse.rs): `cargo run -p traq-markdown-grammar --example parse`

公開 TS / Go SDK の Wasm はこの配布層を利用し、共通の AST 形式で結果を受け取る。SDK と Wasm の対応はビルド ID で確認する。

`bun run check:architecture` で、処理プリセットと拡張部品の依存方向、
および ネイティブ renderer / extractor が AST codec を使わないことを検査する。
