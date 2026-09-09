# markdown-generic-syntax

数式、表、取り消し線、mark、linkify を個別の plugin として提供する。
各モジュールの `plugin()` を `GrammarBuilder::add` / `remove` に渡す。
rule の参照を使い、利用側が CommonMark のルールに対する順序を指定する。

ノード型は `markdown-generic-contracts`、リンクとテキストは
`markdown-commonmark-contracts` が所有する。区切り処理や URL の扱いは
CommonMark の補助処理を共有する。traQ 固有の文法には依存しない。

第三者由来のアルゴリズム・データの通知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。
