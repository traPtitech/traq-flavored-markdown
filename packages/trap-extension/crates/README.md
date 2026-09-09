# traP 拡張部品

| ディレクトリ | package | 責務 |
| --- | --- | --- |
| contracts | markdown-trap-contracts | 参照・スタンプ・spoiler などのノード型 |
| syntax | markdown-trap-syntax | traP 固有の構文と互換ルール |
| [text](text/README.md) | markdown-trap-text | traP 拡張のテキスト描画 |
| [extraction](extraction/README.md) | markdown-trap-extraction | 参照情報の抽出 |

contracts は文法や描画の実装から独立し、text / extraction は parser に依存しません。
traQ の文法プリセットと通知・参照抽出プリセットは
[traq](https://github.com/traq-markdown-parser/traq/tree/main/crates) にあります。
各 package はこの workspace 内で同じ版を使い、core・commonmark・traq とは独立して更新できます。
