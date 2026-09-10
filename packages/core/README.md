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

Rust は ルートの `rust-toolchain.toml` で固定しています。他のリポジトリの checkout は不要です。

```sh
cargo test --workspace --all-features
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo run -p markdown-codec --example round_trip
```

## パッケージの境界

- [commonmark](../commonmark/README.md): 標準文法と汎用拡張
- [trap-extension](../trap-extension/README.md): traP 固有の構文・描画・抽出部品
- [traq](../traq/README.md): traQ の文法・処理の構成、Wasm 配布、TypeScript / Go bindings

core はこれらへ依存しません。テストにも独立した契約型を使います。workspace 内の crate はローカルパスで参照します。レジストリへの公開はまだ行っていません。

## TypeScript / HTML rendering

TypeScript の実装もこのリポジトリの責務に合わせて配置しています。

| TypeScript package                     | 責務                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `@traq-markdown-parser/core`           | 共通 AST 型、HTML handler・Plugin・PresetBuilder、契約検証と生成の基盤 |
| `@traq-markdown-parser/commonmark`     | CommonMark・汎用拡張の生成ノード型と HTML 描画                         |
| `@traq-markdown-parser/trap-extension` | traP の生成ノード型・参照・スタンプ等の HTML 描画                      |
| `@traq-markdown-parser/traq`           | Wasm / Go / TypeScript 配布、traQ の描画構成・preview・CSS             |

開発手順は [ルートの README](../../README.md) を参照してください。ルートで `bun install`・`bun run build` を実行すると、4パッケージを依存順にビルドします。`bun run check:package` は4パッケージを pack し、独立した consumer で配布内容を検証します。

AST の共通形は core の `typescript/ast.ts` に一度だけ定義し、traq の生成 bindings はそれを構文の union で特殊化します。構文の payload は Rust を正として生成し、commonmark と trap-extension の `bun run generate:bindings` でそれぞれの契約 crate から再生成できます。

HTML API は `/renderer` サブパスです。traQ は `@traq-markdown-parser/traq/renderer` の `messageRenderers`、CSS は `@traq-markdown-parser/traq/index.css` を利用します。

## Go

The `github.com/uni-kakurenbo/traq-markdown-engine/packages/core/go` module owns `ast` (shared tree and decoding) and `binding` (the Wasm ABI runtime). It has no CommonMark or traQ preset dependency. Node payloads come from the owning extension modules. Run `go -C go test ./...` to check it.

HTML renderers expose `render(document)`. Handlers render children with `ctx.render(nodes)`. The default fallback returns HTML-escaped source without adding markup. Configure it with `PresetBuilder.build({ fallback: escapedSource => ... })`. Paragraphs, headings, and other HTML structure belong to node handlers; core has no block/inline rendering mode.
