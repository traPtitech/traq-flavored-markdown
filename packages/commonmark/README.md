# CommonMark and reusable extensions

CommonMark 0.31.2 と汎用 Markdown 拡張の文法・ノード契約・テキスト描画を所有します。

| crate | 責務 |
| --- | --- |
| `markdown-commonmark-contracts` | CommonMark の型付きノード |
| `markdown-commonmark` | CommonMark の構文解析 |
| `markdown-commonmark-text` | CommonMark AST のテキスト描画 |
| `markdown-generic-contracts` | 数式、表、取り消し線、mark のノード契約 |
| `markdown-generic-syntax` | 汎用拡張の構文解析 |
| `markdown-generic-text` | 汎用拡張のテキスト描画 |

各機能は独立した crate として利用できます。契約と構文実装は同じリポジトリで管理し、ノードを読むだけの処理が構文解析へ依存する必要はありません。

## 開発

```sh
cargo test --locked --workspace --all-features
cargo fmt --all --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
```

Rust の版は `rust-toolchain.toml`、外部依存の版は manifest と `Cargo.lock` で固定しています。core は Git の確定 revision から取得されるため、他の checkout は不要です。CommonMark の652仕様例を同梱して検証します。出典・ライセンスは [fixtures](tests/fixtures/README.md) を参照してください。

## 境界

依存先は [core](https://github.com/traq-markdown-parser/core) です。traP / traQ の文法・preset・アプリケーション方針は知りません。

traP 固有の拡張部品は [trap-extension](https://github.com/traq-markdown-parser/trap-extension)、traQ 向けの構成と Wasm・TypeScript / Go bindings は [traq](https://github.com/traq-markdown-parser/traq)、HTML と CSS は [traq-markdown-it](https://github.com/traPtitech/traq-markdown-it) にあります。

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

## Go contracts

The Go module is `github.com/traq-markdown-parser/commonmark/go`. Payloads and node factories are generated from this repository's Rust contracts by `npm run generate:bindings`. The canonical tree and Wasm runtime belong to the core Go module.
