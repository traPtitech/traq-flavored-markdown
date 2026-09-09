# traQ Markdown

traQ 向けの Markdown 文法・通知処理の構成と、Rust・WebAssembly・Go・TypeScript 向けの配布を所有します。文法・AST の契約・検証は Rust が所有します。

- npm: **`@traq-markdown-parser/traq`**
- Go module: **`github.com/traq-markdown-parser/traq/go`**
- Wasm: ABI **3** / AST **4**

文法の実装は [core](https://github.com/traq-markdown-parser/core)、[commonmark](https://github.com/traq-markdown-parser/commonmark)、[trap-extension](https://github.com/traq-markdown-parser/trap-extension) にあります。このリポジトリで配布するプリセットを選び、Wasm と対応する型を生成します。

## 構成と責任

| 場所 | 責任 |
| --- | --- |
| `crates/grammar` | CommonMark・汎用拡張・traP 拡張を選択し、文法プリセットを構成 |
| `crates/processing` | AST を受け取る PlainText renderer と extractor、および traQ 向けの方針を構成 |
| `crates/wasm` | 配布する文法・ノード型・処理 API を Wasm として公開 |
| `go`・`typescript`・`scripts/contracts` | この配布物に対応する bindings と型生成 |

共通機構は core、CommonMark と汎用拡張は commonmark、traP 固有の拡張部品は
trap-extension にあります。このリポジトリがそれらに依存し、traQ 向けに組み合わせます。
下位の部品はこの配布物に依存しません。bindings はここで選んだ型とプリセットに対応します。

## ビルド

Node.js 24 以降、Go 1.26 以降、rustup が必要です。Rust と Wasm target は `rust-toolchain.toml` で固定しています。

```sh
npm ci
npm run build
npm run examples
```

Rust の依存は Cargo が固定した Git revision を取得します。TypeScript のローカルビルドでは、同じ親ディレクトリに core・commonmark・trap-extension を置き、依存順に `npm ci` と `npm run build` を実行しておきます。Wasm・JavaScript・型定義は `dist/` に出力します。Rust から生成する TypeScript / Go のソースと、対応する Rust ビルド ID はソース管理します。バイナリと SDK は同じソース・固定依存から生成した組を配布してください。

まだレジストリへ公開していません。TypeScript は4パッケージの `npm pack` アーカイブを利用できます。

## TypeScript

```ts
import { createRuntime, presets } from '@traq-markdown-parser/traq'

const runtime = await createRuntime(wasmBytes)
try {
  const parser = runtime.createParser(presets.traq.v1)
  const document = parser.parse('**hello** :stamp:')
  const inline = parser.parseInline('**hello**')
} finally {
  runtime.dispose()
}
```

`wasmBytes` は `Uint8Array` です。Node.js は `@traq-markdown-parser/traq/parser.wasm` を `readFile` で読み、ブラウザーは `new Uint8Array(await response.arrayBuffer())` を渡します。Runtime と Parser は再利用できます。同じ Runtime から異なるプリセットの Parser も作成できます。

ノード型は判別可能な union です。文法別の payload 型と任意利用の guard は `@traq-markdown-parser/commonmark/nodes`・`@traq-markdown-parser/commonmark/generic/nodes`・`@traq-markdown-parser/trap-extension/nodes`、配布物全体の一覧は `@traq-markdown-parser/traq/nodes` から利用できます。

## Go

```go
import markdown "github.com/traq-markdown-parser/traq/go"

runtime, err := markdown.NewRuntime(ctx, wasmBytes)
if err != nil { return err }
defer runtime.Close(ctx)

parser, err := runtime.NewParser(ctx, markdown.PresetTraQV1)
if err != nil { return err }
defer parser.Close(ctx)
document, err := parser.Parse(ctx, "**hello** :stamp:")
```

`Parse` / `ParseInline` は `*markdown.Document` を返します。`Node.Data` の具体的な型も Rust から生成します。Runtime は Wasm のコンパイル結果を共有します。一つの Parser の呼び出しは直列化し、並列実行には同じ Runtime から Parser を複数作ります。`Parser.Close` はその Parser だけ、`Runtime.Close` は配下の全 Parser を解放します。

## 文法の変更

文法バージョンは、本文がどの構文規則で書かれたかを示す永続的な識別子です。
パッケージのバージョンとは独立しており、パッケージを更新しても既存の識別子の意味を変えません。
processing・renderer には独立した文法バージョンを設けず、選択された文法が生成した AST を処理します。

文法のレジストリは Rust の `bindings::grammars()` にあります。
`bindings::parser(version)` が名前から Grammar を選び、Parser を生成します。
Go / TypeScript には文法構成を複製せず、Wasm 境界では文法バージョンの文字列を渡します。
`presets.traq.v1` / `PresetTraQV1` はその文字列を表す生成済み定数です。
Rust の配布層がバージョンを解決し、共通のパーサー生成や処理機構は文法バージョンを知りません。

TypeScript の `runtime.createParser(version)`、
Go の `NewParser(ctx, Preset(version))` に
DB から読み出したバージョンを指定できます。未知のバージョンはエラーになり、最新文法への暗黙の置き換えはしません。
同じ Runtime から作成したパーサーを `Map<string, Parser>` に保持して使い分けられます。

```ts
import type { Parser } from '@traq-markdown-parser/traq'

const parsers = new Map<string, Parser>()
for (const message of messages) {
  let parser = parsers.get(message.grammarVersion)
  if (!parser) {
    parser = runtime.createParser(message.grammarVersion)
    parsers.set(message.grammarVersion, parser)
  }
  const document = parser.parse(message.text)
  const result = view.render(document)
}
```

DB に保存するのは永続的な文法バージョンです。SDK と Wasm の対応を確認するビルド ID は
保存用バージョンではなく、パッケージ更新後も同じ文法バージョンで旧文法を選択できます。

新しい文法は Rust の文法定義と `crates/grammar/src/presets/exports.rs` の公開カタログに追加します。
選択レジストリと Go / TypeScript の定数はこのカタログを使うため、言語ごとの分岐や processing / renderer のバージョン追加は不要です。
既存文法の共有ルールを変更するときは、旧文法の解釈を維持してください。解釈を変えるルールだけを分離し、
旧実装を旧文法に残します。変更のないルールや AST の処理コードを文法ごとに複製する必要はありません。
既存の v1 AST fixture は互換性検証に使い、文法を更新する目的で期待値を上書きしません。


TypeScript の `presets.commonmark` / `presets.traq.v1`、Go の `PresetCommonMark` / `PresetTraQV1` は Rust が公開するプリセットから生成します。独自の文法は Rust で組み立て、配布層からプリセットとして公開して再ビルドします。ホスト API は文法からのパーサー生成、解析、解放を提供します。

Wasm のホスト実装は TypeScript の `index.ts` と Go の `parser.go` です。共通 AST 型と payload guard の検証部品は core、構文の生成型はそれぞれのリポジトリが所有します。文法ビルダー、Plugin / Rule のミラー、文法ハンドル、worker pool は持ちません。

HTML 描画の共通基盤は core、構文別の描画は commonmark と trap-extension が担当します。traQ の描画構成・condensed 表示・CSS はこのリポジトリの `typescript/renderer` が所有します。

[API と実装](docs/implementation.md)、[実行例](examples/README.md)、[開発と検証](CONTRIBUTING.md) を参照してください。

## AST からの描画と抽出

Parser が返す Document を renderer と extractor に直接渡します。文法を選択するのは Parser だけです。
TypeScript の HTML renderer はホスト上で AST を描画し、Extractor と Go の PlainTextRenderer は
渡された AST を Wasm の Rust 実装に渡します。Markdown 原文の再解析は行いません。

```ts
const parser = runtime.createParser(presets.traq.v1)
const extractor = runtime.createExtractor({ origin: 'https://q.example.test' })
const document = parser.parse('**hello** !!secret!!')
const { references, embedding, messageText } = extractor.extract(document)
const html = view.render(document)
```

```go
parser, err := runtime.NewParser(ctx, markdown.PresetTraQV1)
if err != nil { return err }
extractor, err := runtime.NewExtractor(ctx, markdown.ExtractorOptions{Origin: origin})
if err != nil { return err }
renderer, err := runtime.NewPlainTextRenderer(ctx, markdown.RendererOptions{Origin: origin})
if err != nil { return err }
document, err := parser.Parse(ctx, "**hello** !!secret!!")
if err != nil { return err }
metadata, err := extractor.Extract(ctx, document)
if err != nil { return err }
notification, err := renderer.Render(ctx, document)
```

各 instance は同じ Runtime のコンパイル結果を共有し、独立した設定を持ちます。
Go の呼び出し直列化・キャンセル規則は各 instance に適用され、Runtime の解放で全 instance を閉じます。
ネイティブ Rust は `traq_markdown_processing::extraction::Extractor` と
`rendering::PlainTextRenderer` が `&Document` を借用します。

PlainTextRenderer は spoiler をマスクし、空白を正規化した一行の通知テキストを返します。
Extractor は参照・添付 ID・引用 ID・埋め込み編集計画と、Markdown 記法を保つ `messageText` を返します。
参照は文書順・重複・spoiler 内を保持し、コード内の文字列は抽出しません。
`origin` が空なら traQ のファイル・メッセージ URL を通常の URL として扱います。

## TypeScript / HTML rendering

TypeScript の実装は各リポジトリの責務に合わせて配置しています。

| npm package | 責務 |
| --- | --- |
| `@traq-markdown-parser/core` | 共通 AST 型、HTML handler・Plugin・PresetBuilder、契約検証と生成の基盤 |
| `@traq-markdown-parser/commonmark` | CommonMark・汎用拡張の生成ノード型と HTML 描画 |
| `@traq-markdown-parser/trap-extension` | traP の生成ノード型・参照・スタンプ等の HTML 描画 |
| `@traq-markdown-parser/traq` | Wasm / Go / TypeScript 配布、traQ の描画構成・condensed 表示・CSS |

ローカル開発では4リポジトリを同じ親ディレクトリに置き、core → commonmark → trap-extension → traq の順に `npm install`・`npm run build` を実行します。npm パッケージはまだ未公開です。配布検証は traq の `npm run check:package` で4パッケージを pack し、独立した consumer で実行します。

AST の共通形は core の `typescript/ast.ts` に一度だけ定義し、traq の生成 bindings はそれを構文の union で特殊化します。構文の payload は Rust を正として生成し、commonmark と trap-extension の `npm run generate:bindings` でそれぞれの契約 crate から再生成できます。

HTML API は `/renderer` サブパスです。traQ は `@traq-markdown-parser/traq/renderer` の `messageRenderers`、CSS は `@traq-markdown-parser/traq/index.css` を利用します。

### HTML の利用例

```ts
import { createRuntime, presets } from "@traq-markdown-parser/traq";
import { messageRenderers } from "@traq-markdown-parser/traq/renderer";
import "@traq-markdown-parser/traq/index.css";

const runtime = await createRuntime(wasmBytes);
const parser = runtime.createParser(presets.traq.v1);
const view = messageRenderers({ origin: "https://q.example.test" });
const document = parser.parse(source);
const { renderedText, embeddings } = view.standard.render(document);
const condensed = view.condensed.render(document);
runtime.dispose();
```

Wasm の起動は利用側が明示的に行います。`/renderer` を import しても Wasm runtime は読み込みません。描画のカスタマイズは `@traq-markdown-parser/core/renderer` の `Plugin`・`PresetBuilder` と、各構文の `/renderer` を利用します。

## Corpus comparison

Use `npm run corpus:collect`, `npm run corpus:compare`, and `npm run corpus:report` to collect messages and generate offline HTML/MHTML difference reports. See [Corpus comparison](docs/CORPUS.md) for inputs, options, and output files.

Go consumers use `github.com/traq-markdown-parser/traq/go` for presets and artifact pairing. Shared AST/transport live in the core Go module; payload factories live in commonmark and trap-extension. `Extractor.Extract` returns source-preserving message text, references, embedding edits, attachment IDs and citation IDs from the supplied Document. `PlainTextRenderer.Render` independently renders that Document for notifications.

Embedding edits are also shared: Rust derives `output.embedding` from the same AST. Pass that plan and an application identity resolver to `embedReferences` (TypeScript) or `EmbedReferences` (Go). `output.embedding.unembeddedText` restores reference labels for copying, and `mentionsUser` checks the extracted references. See [processing presets](crates/processing/README.md) for the editing rules.
