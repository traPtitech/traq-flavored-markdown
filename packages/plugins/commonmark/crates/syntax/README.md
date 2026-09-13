# markdown-commonmark

CommonMark の block / inline ルール。parser core と CommonMark のノード契約を利用する。
traQ の文法や配布 package には依存しない。

`Syntax::default()` が基本ルールと text provider を持つ plugin、拡張の配置に使う
`inline` / `block` のルール参照を返す。HTML は `html::plugin()` として選択する。
`LinkOptions` は構文の認識と URL 処理を設定する。

文法の順序は利用側の `GrammarBuilder` が決める。数式や spoiler の追加のために
CommonMark の実装を編集する必要はない。

[CommonMark だけを組み立てる例](examples/compose.rs):
`cargo run -p markdown-commonmark --example compose`

第三者由来のアルゴリズム・データの通知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。
