# CommonMark と汎用拡張

CommonMark と、数式・表・linkify などの汎用拡張を管理する系列です。
各行は独立した Cargo package で、共通のリリース単位として扱います。

| ディレクトリ | package | 責務 |
|---|---|---|
| contracts | markdown-commonmark-contracts | CommonMark のノード型・検証・共有宣言 |
| [syntax](syntax/README.md) | markdown-commonmark | CommonMark の構文ルールと HTML 構文 |
| [text](text/README.md) | markdown-commonmark-text | CommonMark のテキスト描画 |
| extensions/contracts | markdown-generic-contracts | 汎用拡張のノード型 |
| extensions/syntax | markdown-generic-syntax | 数式・表・linkify などの構文ルール |
| extensions/text | markdown-generic-text | 汎用拡張のテキスト描画 |

構文実装と描画実装はノード契約だけを共有し、互いの実装へ依存しません。
この系列の通常の依存先は core と同系列に限定し、traP の拡張や preset を参照しません。

package に拡張が含まれることと、文法として採用することは別です。
採用する Plugin は利用側の GrammarBuilder が選択し、厳密な CommonMark の構成も維持できます。

配下の package は同じ版で管理します。core・traP 系列とは独立して更新できます。
ルートの workspace で開発し、[共通の検証と更新手順](../README.md#開発)に従います。
