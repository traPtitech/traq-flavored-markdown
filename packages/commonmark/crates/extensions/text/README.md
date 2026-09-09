# markdown-generic-text

数式、表、mark、取り消し線のテキスト描画。parser や traQ、CommonMark の実装に依存しない。
ノードの契約と renderer core のみを参照する。

`math::plugin()` / `table::plugin()` / `mark::plugin()` / `strikethrough::plugin()` を
PresetBuilder の add / remove に渡す。設定不要で、共有済みの Plugin を値で返す。
呼び出し側の clone は不要。型ごとの変更は Plugin::replace を使う。

数式は TeX 本文、表はセル間の ` | ` と行末改行、装飾は子のテキストを出力する。
linkify は CommonMark の Link ノードを生成するため、専用の描画 Plugin は不要。
