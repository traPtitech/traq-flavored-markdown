# Markdown core

文法に依存しない Markdown 処理の基盤です。CommonMark や traP の具体的な構文・ノード型・preset は含みません。

| crate | 責務 |
| --- | --- |
| `markdown-ast` | 型付き AST、原文、UTF-8 span |
| `markdown-definitions` / `markdown-definitions-derive` | 宣言の同一性、ノードの型情報 |
| `markdown-parser` | 文法の組み立て、ルール実行、処理量の制限 |
| `markdown-renderer` | AST の描画・テキスト生成基盤 |
| `markdown-extractor` | AST からの情報抽出基盤 |
| `markdown-codec` | 登録されたノード契約に基づく JSON encode / decode |

各 crate の README に API の例があります。

## 開発

Rust は `rust-toolchain.toml` で固定しています。他のリポジトリの checkout は不要です。

```sh
cargo test --workspace --all-features
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo run -p markdown-codec --example round_trip
```

## リポジトリの境界

- [commonmark](https://github.com/traq-markdown-parser/commonmark): 標準文法と汎用拡張
- [trap-extension](https://github.com/traq-markdown-parser/trap-extension): traP 固有の構文・描画・抽出部品
- [traq](https://github.com/traq-markdown-parser/traq): traQ の文法・処理の構成、Wasm 配布、TypeScript / Go bindings

core はこれらへ依存しません。テストにも独立した契約型を使います。リポジトリ内の crate は同じ版で管理し、外部からは確定した Git revision を指定して利用します。レジストリへの公開はまだ行っていません。

## TypeScript / HTML rendering

TypeScript の実装もこのリポジトリの責務に合わせて配置しています。

| npm package | 責務 |
| --- | --- |
| `@traq-markdown-parser/core` | 共通 AST 型、HTML handler・Plugin・PresetBuilder、契約検証と生成の基盤 |
| `@traq-markdown-parser/commonmark` | CommonMark・汎用拡張の生成ノード型と HTML 描画 |
| `@traq-markdown-parser/trap-extension` | traP の生成ノード型・参照・スタンプ等の HTML 描画 |
| `@traq-markdown-parser/traq` | Wasm / Go / TypeScript 配布、traQ の描画構成・preview・CSS |

ローカル開発では4リポジトリを同じ親ディレクトリに置き、core → commonmark → trap-extension → traq の順に `npm install`・`npm run build` を実行します。npm パッケージはまだ未公開です。配布検証は traq の `npm run check:package` で4パッケージを pack し、独立した consumer で実行します。

AST の共通形は core の `typescript/ast.ts` に一度だけ定義し、traq の生成 bindings はそれを構文の union で特殊化します。構文の payload は Rust を正として生成し、commonmark と trap-extension の `npm run generate:bindings` でそれぞれの契約 crate から再生成できます。

HTML API は `/renderer` サブパスです。traQ は `@traq-markdown-parser/traq/renderer/v1` の `messageRenderer`、CSS は `@traq-markdown-parser/traq/index.css` を利用します。

## Go

The `github.com/traq-markdown-parser/core/go` module owns `ast` (shared tree and decoding) and `binding` (the Wasm ABI runtime). It has no CommonMark or traQ preset dependency. Node payloads come from the owning extension modules. Run `go -C go test ./...` to check it.

HTML renderers expose `render(document)`. Handlers render children with `ctx.render(nodes)`. The default fallback returns HTML-escaped source without adding markup. Configure it with `PresetBuilder.build({ fallback: escapedSource => ... })`. Paragraphs, headings, and other HTML structure belong to node handlers; core has no block/inline rendering mode.
