# Core

文法に依存しない共通機構を管理する系列です。各行が独立した Cargo package です。

| ディレクトリ | package | 責務 |
|---|---|---|
| [ast](ast/README.md) | markdown-ast | 文法・serde 非依存の型付き AST |
| [definitions](definitions/README.md) | markdown-definitions | Plugin の共有宣言と型メタデータ |
| definitions-derive | markdown-definitions-derive | NodeType の derive 実装 |
| [parser](parser/README.md) | markdown-parser | 文法を組み合わせて実行する機構 |
| [renderer](renderer/README.md) | markdown-renderer | 型付き handler による描画 |
| [extractor](extractor/README.md) | markdown-extractor | 型付き handler による情報抽出 |
| [codec](codec/README.md) | markdown-codec | 登録されたノード契約の JSON 入出力 |

通常の依存はこの系列の内部と外部ライブラリに限定します。
AST だけの利用に parser・renderer・serde は必要ありません。
parser / renderer / extractor は codec に依存せず、native AST を共有できます。

配下の package は同じ版で管理します。CommonMark・traP 系列とは独立して更新できます。
ルートの workspace で開発し、[検証手順](../README.md#開発)に従います。
