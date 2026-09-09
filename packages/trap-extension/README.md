# traP Markdown extensions

traP 固有の Markdown 拡張部品を提供します。traQ 向けの組み合わせと配布は
[traq](https://github.com/traq-markdown-parser/traq) が所有します。

| crate | 責務 |
| --- | --- |
| `markdown-trap-contracts` | スタンプ、参照、spoiler、空行のノード契約 |
| `markdown-trap-syntax` | traP 拡張の構文解析 |
| `markdown-trap-text` | traP ノードのテキスト描画 |
| `markdown-trap-extraction` | 参照などの抽出 |

各ルールの Plugin を、利用側の GrammarBuilder / PresetBuilder に追加して使います。
文法の選択と順序、通知 URL の表示方針、処理結果の組み合わせは利用側で決めます。
[traQ の構成・実行例](https://github.com/traq-markdown-parser/traq/tree/main/crates/processing)
を参照してください。

## 開発

```sh
cargo test --locked --workspace --all-features
cargo fmt --all --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
```

Rust の版は `rust-toolchain.toml` で固定しています。依存する
[core](https://github.com/traq-markdown-parser/core) と
[commonmark](https://github.com/traq-markdown-parser/commonmark) は Git の確定 revision
から取得するため、他の checkout は不要です。traQ の構成・配布には依存しません。

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

The Go module is `github.com/traq-markdown-parser/trap-extension/go`. Payloads and node factories are generated from this repository's Rust contracts by `npm run generate:bindings`. The canonical tree and Wasm runtime belong to the core Go module.
