# markdown-trap-syntax

traP の JSON 参照、スタンプ、spoiler と traQ V1 の互換ルールを提供する。
各モジュールの `plugin()` は独立して文法に追加・削除できる。
構文の優先順位と組み合わせは配布層の preset が決める。

ノード型は `markdown-trap-contracts` が所有する。参照情報の抽出や通知の表示は
この package の責務ではない。CommonMark の区切り・引用・URL 処理を利用する。

第三者由来のアルゴリズムの通知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。
