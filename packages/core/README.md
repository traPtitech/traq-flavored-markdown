# Markdown core

文法に依存しない Markdown 処理の基盤です。CommonMark や traP の具体的な構文・ノード型・preset は含みません。

| crate                                                  | 責務                                              |
| ------------------------------------------------------ | ------------------------------------------------- |
| `markdown-ast`                                         | 型付き AST、原文、UTF-8 span                      |
| `markdown-definitions` / `markdown-definitions-derive` | 宣言の同一性、ノードの型情報                      |
| `markdown-parser`                                      | 文法の組み立て、ルール実行、処理量の制限          |
| `markdown-renderer`                                    | AST の描画・テキスト生成基盤                      |
| `markdown-extractor`                                   | AST からの情報抽出基盤                            |
| `markdown-codec`                                       | 登録されたノード契約に基づく JSON encode / decode |

各 crate の README に API の例があります。

## 開発

共通の環境準備と検証は [ルートの CONTRIBUTING](../../CONTRIBUTING.md) に従います。

## パッケージの境界

- [commonmark-plugin](../plugins/commonmark/README.md): 標準文法と汎用拡張
- [traq-plugin](../plugins/traq/README.md): traP 固有の構文・描画・抽出部品
- [sdk](../sdk/README.md): traQ の文法・処理の構成、Wasm 配布、TypeScript / Go bindings

core はこれらへ依存しません。テストにも独立した契約型を使います。workspace 内の crate はローカルパスで参照します。レジストリへの公開はまだ行っていません。

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

## Go

The `github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go` module owns `ast` (shared tree and decoding) and `binding` (the Wasm ABI runtime). It has no CommonMark or traQ preset dependency. Node payloads come from the owning extension modules. Run `go -C go test ./...` to check it.

HTML renderers expose `render(document)`. Handlers render children with `ctx.render(nodes)`. The default fallback returns HTML-escaped source without adding markup. Configure it with `PresetBuilder.build({ fallback: escapedSource => ... })`. Paragraphs, headings, and other HTML structure belong to node handlers; core has no block/inline rendering mode.
