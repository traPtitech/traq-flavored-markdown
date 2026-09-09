# markdown-trap-text

traP 固有ノードのテキスト描画。parser / extractor の実装には依存しない。

`references::plugin()` / `stamp::plugin()` / `spoiler::plugin()` / `compat::plugin()` を
PresetBuilder の add / remove に渡す。設定不要で、共有済みの Plugin を値で返す。
呼び出し側の clone は不要。型ごとの変更は Plugin::replace を使う。

参照は表示ラベル、スタンプは literal、互換用の空行は改行として出力する。
spoiler は子の表示結果を chars() で数え、改行以外を █ に置換する。
通知の送信先抽出、URL の分類、空白の整理は別の処理。

[各文法の Plugin を組み合わせる実行例](https://github.com/traq-markdown-parser/traq/blob/main/crates/processing/examples/compose-text.rs):
traq リポジトリで `cargo run -p traq-markdown-processing --example compose-text` を実行します。
