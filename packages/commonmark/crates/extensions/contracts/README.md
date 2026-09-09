# markdown-generic-contracts

汎用拡張のノード型を所有する契約パッケージ。数式、表、mark、strikethrough の 7 型を定義する。
parser、renderer、codec には依存しない。

`preset()` は math / table / mark / strikethrough / linkify の共有 Plugin 宣言を返す。
一つの generic group に一度だけ生成し、parser / renderer が同じインスタンスを使う。
実行する plugin の選択・順序を決める文法や描画の preset とは別。
linkify は CommonMark の Link / Text を生成するため、専用ノード型は持たない。

`NodeData` の検証、serde による payload 入出力、`NodeType` による型の識別は型側に置く。
文法・表示・抽出規則はここには含めない。`contracts` feature は既存の TS 型・JSON Schema の
生成を引き継ぐためのオプションで、通常の Wasm 配布では不要。

生成キーは型の定義元を反映する。たとえば `markdown_generic_contracts::math::InlineMathData`。
永続的な AST 保存形式や文法バージョンを表す ID ではない。
