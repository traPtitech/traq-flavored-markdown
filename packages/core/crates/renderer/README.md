# markdown-renderer

型付きノードから文字列を生成する core。AST と共有宣言のみを参照し、
CommonMark / traQ / parser / codec には依存しない。

```rust
use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_renderer::{Plugin, PresetBuilder, Renderer};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {}

let prefix = String::from("hello ");
let mut plugin = Plugin::new(&Declaration::new("greeting"));
plugin.on::<Text>(move |text, _, _| Ok(format!("{prefix}{}", text.0)))?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
let preset = builder.build()?;
let renderer = Renderer::new(&preset);
let document = Document {
    source: "world".into(),
    children: vec![Node::leaf(Span { start: 0, end: 5 }, Text("world".into()))],
};
assert_eq!(renderer.render(&document)?, "hello world");
# Ok::<(), &'static str>(())
```

`Plugin::on` は具体的なノード型と handler を登録する。設定はクロージャに保持する。
同じ preset から作った renderer は handler と設定を共有し、描画ごとの処理量は独立する。
登録済み型の変更には `Plugin::replace::<T>(handler)` を使う。
未登録型の replace は `missing_handler`、登録済み型への on は `duplicate_handler` を返す。
失敗した操作は snapshot を変えず、成功した差し替えも既存の preset / renderer には影響しない。
handler は `Send + Sync`。renderer ごとの可変 State や JSON 変換は要求しない。

`PresetBuilder::add/remove` は Plugin の実装 snapshot を参照する。
登録後に Plugin を編集しても、既存 builder / preset / renderer は変化しない。
既存の構成から削除する際は、登録時の snapshot を渡す。
型の handler 重複、同じ Plugin の二重登録、同一 scope の表示名重複は拒否する。

render は原文位置・ノード固有の検証・未対応型を全子孫に対して検査してから描画する。
親 handler が表示しない子も検査対象。文字列の HTML エスケープ等は handler の責務。
上限は元の通知 renderer と同じ: 原文65,536 bytes、16,384 nodes、深さ64、
出力1 MiB、append の累積8 MiB。handler の処理自体は信頼する Rust コード。

この crate はクロージャ方式の core。公開 SDK の移植は進行中。
