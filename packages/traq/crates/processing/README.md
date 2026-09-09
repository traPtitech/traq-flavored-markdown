# traQ processing presets

通知の描画と参照の抽出を組み合わせる配布 crate です。通常の依存に parser・codec を含まず、
各実装は `commonmark-text` / `generic-text` / `trap-text` / `trap-extraction` が所有します。

```rust
use markdown_extractor::Extractor;
use markdown_renderer::Renderer;
use traq_markdown_processing::presets::traq;

let renderer = Renderer::new(&traq::notification::preset("https://q.example.test")?);
let extractor = Extractor::new(&traq::references::preset()?);
// parser が生成した同じ Document を借用する。
let text = renderer.render(&document)?;
let references = extractor.extract(&document)?;
```

実行可能な例は [examples/notification.rs](examples/notification.rs) にあります。
リポジトリ root で `cargo run -p traq-markdown-processing --example notification` を実行してください。
AST の JSON 変換を挟まず、最終結果だけを JSON として出力します。

`notification::builder(origin)` / `references::builder()` は編集可能な builder を返します。
Plugin の `add` / `remove` 後に `build()` し、汎用 Renderer / Extractor に渡せます。
作成済みの実行インスタンスは、別の構成の編集や構築によって変化しません。

通知はブロック間の改行を残します。一行への整形は利用側で行います。
spoiler は描画した内容の Unicode scalar value 数だけ `█` を並べ、改行は保持します。
空の origin はリンクの特別表示を無効にします。origin は最大 2,048 UTF-8 バイトです。
同じ origin の `/files/{uuid}` / `/messages/{uuid}` は添付・引用の表示になりますが、
明示的なリンクラベルとコード内の文字列は維持します。URL 判定は文字列による比較です。

参照抽出は user / group / channel の ID を正規化して返します。順序・重複を保持し、
spoiler 内も対象です。コード内は parser が参照ノードを生成しないため対象になりません。
`message::Extractor` は同じ AST から本文・添付 ID・引用 ID を作ります。本文は Markdown 記法と改行を保ち、参照 JSON をラベル、ファイル・引用 JSON と裸の URL を表示用の文字列へ置換します。明示的なリンクの Markdown 記法はそのまま保持します。添付・引用 ID は出現順・重複・spoiler 内を含み、コードや数式内の文字列は対象になりません。ユーザー情報の解決や通知送信は含みません。

JSON 設定や Wasm のリソース管理は SDK 接続層の責務です。
`references.embeddings` は認識した参照・埋め込みの `raw` / `type` / `id` を AST の出現順に返します。Bot イベントはこの結果を再利用でき、ID の UUID 検証前の文字列も保持されます。

埋め込みの生成・復元は `embedding::plan(&document)` が担当します。Rust の AST で認識された通常テキストだけを名前解決候補にし、コード・数式・リンク・画像・既存の埋め込みに新しい参照を作りません。エスケープされた記号と文字参照も保持します。ユーザー、グループ、ユーザー名の ASCII 接頭辞の順に解決を試み、チャンネル名も同じ計画に含めます。

候補の位置は元のソースに対する UTF-8 byte offset です。Go の `EmbedReferences` / TypeScript の `embedReferences` に解析結果の `embedding` とアプリの名前解決関数を渡すと、解決できた範囲だけを JSON 埋め込みへ置換します。その他の Markdown 記法と空白は保ちます。復元結果は `embedding.unembeddedText`、メンション検知は解析済み `references` に対する `mentionsUser` を利用できます。DB・store・送信・クリップボード操作はアプリ側の責務です。

公開 API は `extraction::Extractor::extract(&Document)` と `rendering::PlainTextRenderer::render(&Document)` です。どちらも呼び出し側が解析した AST を借用し、文法の選択・原文の再解析は行いません。
