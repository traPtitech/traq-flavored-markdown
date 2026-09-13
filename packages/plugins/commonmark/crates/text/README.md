# markdown-commonmark-text

CommonMark の AST を文字列にする描画 Plugin。文法の parser や traQ に依存しない。
`plugin()` は通常のノード、`html::plugin()` は HTML ノードを扱う。
リンクはラベル、コードは内容、リストは番号や箇条書き記号を出力する。
HTML ノードの内容は文字列として出力するため、HTML 描画先へ渡す際のエスケープは利用側の責務。

```rust
use markdown_commonmark_contracts::Link;
use markdown_commonmark_text as commonmark;
use markdown_renderer::{PresetBuilder, Renderer};

let mut plugin = commonmark::plugin();
plugin.replace::<Link>(|link, _, _| Ok(link.destination.clone()))?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
builder.add(&commonmark::html::plugin())?;
let renderer = Renderer::new(&builder.build()?);
# Ok::<(), &'static str>(())
```

呼び出し側に clone を要求せず、共有済み実装の Plugin を値で返す。
同じ factory の既定 Plugin は同じ snapshot を共有する。
replace で編集するとその Plugin だけが変わり、以後の factory 呼び出しや既存の構成には影響しない。
段落間の改行を保持する。通知向けの空白整理や送信は、この package には含めない。
