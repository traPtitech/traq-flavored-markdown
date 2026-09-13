# traq-plugin: traP Markdown extensions

traP 固有の Markdown 拡張部品を提供します。traQ 向けの組み合わせと配布は
[SDK](../../sdk/README.md) が所有します。

| crate                      | 責務                                      |
| -------------------------- | ----------------------------------------- |
| `markdown-trap-contracts`  | スタンプ、参照、spoiler、空行のノード契約 |
| `markdown-trap-syntax`     | traP 拡張の構文解析                       |
| `markdown-trap-text`       | traP ノードのテキスト描画                 |
| `markdown-trap-extraction` | 参照などの抽出                            |

各ルールの Plugin を、利用側の GrammarBuilder / PresetBuilder に追加して使います。
文法の選択と順序、通知 URL の表示方針、処理結果の組み合わせは利用側で決めます。
[SDK の構成・実行例](../../sdk/crates/processing)
を参照してください。

## 開発

共通の環境準備と検証は [ルートの CONTRIBUTING](../../../CONTRIBUTING.md) に従います。依存する
[core](../../core/README.md) と
[commonmark-plugin](../commonmark/README.md) は同じ workspace のローカルパスから参照します。SDK の構成・配布には依存しません。

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

The Go module is `github.com/uni-kakurenbo/traq-markdown-engine/packages/plugins/traq/go`. Payloads and node factories are generated from this repository's Rust contracts by `bun run generate:bindings`. The canonical tree and Wasm runtime belong to the core Go module.
