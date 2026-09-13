# commonmark-plugin: CommonMark and reusable extensions

CommonMark 0.31.2 と汎用 Markdown 拡張の文法・ノード契約・テキスト描画を所有します。

| crate                           | 責務                                    |
| ------------------------------- | --------------------------------------- |
| `markdown-commonmark-contracts` | CommonMark の型付きノード               |
| `markdown-commonmark`           | CommonMark の構文解析                   |
| `markdown-commonmark-text`      | CommonMark AST のテキスト描画           |
| `markdown-generic-contracts`    | 数式、表、取り消し線、mark のノード契約 |
| `markdown-generic-syntax`       | 汎用拡張の構文解析                      |
| `markdown-generic-text`         | 汎用拡張のテキスト描画                  |

各機能は独立した crate として利用できます。契約と構文実装は同じリポジトリで管理し、ノードを読むだけの処理が構文解析へ依存する必要はありません。

## 開発

共通の環境準備と検証は [ルートの CONTRIBUTING](../../../CONTRIBUTING.md) に従います。CommonMark の 652 仕様例の出典とライセンスは [root fixture](../../../tests/fixtures/README.md) に記載しています。

## 境界

依存先は [core](../../core/README.md) です。traP / traQ の文法・preset・アプリケーション方針は知りません。

traP 固有の拡張部品は [traq-plugin](../traq/README.md)、traQ 向けの構成と Wasm・TypeScript / Go bindings は [sdk](../../sdk/README.md)、HTML 描画は各パッケージの `typescript/renderer`、traQ の CSS は SDK パッケージにあります。

## TypeScript / HTML rendering

TypeScript の実装もこのリポジトリの責務に合わせて配置しています。

| TypeScript package                        | 責務                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `@traq-markdown-engine/core`              | 共通 AST 型、HTML handler・Plugin・PresetBuilder、契約検証と生成の基盤 |
| `@traq-markdown-engine/commonmark-plugin` | CommonMark・汎用拡張の生成ノード型と HTML 描画                         |
| `@traq-markdown-engine/traq-plugin`       | traP の生成ノード型・参照・スタンプ等の HTML 描画                      |
| `@traq-markdown-engine/sdk`               | Wasm / Go / TypeScript 配布、traQ の描画構成・preview・CSS             |

AST の共通形は core の `typescript/ast.ts` に一度だけ定義し、SDK の生成 bindings はそれを構文の union で特殊化します。構文の payload は Rust を正として生成し、commonmark-plugin と traq-plugin の `bun run generate:bindings` でそれぞれの契約 crate から再生成できます。

HTML API は `/renderer` サブパスです。traQ は `@traq-markdown-engine/sdk/renderer` の `messageRenderers`、CSS は `@traq-markdown-engine/sdk/index.css` を利用します。

## Go contracts

The Go module is `github.com/uni-kakurenbo/traq-markdown-engine/packages/plugins/commonmark/go`. Payloads and node factories are generated from this repository's Rust contracts by `bun run generate:bindings`. The canonical tree and Wasm runtime belong to the core Go module.
