# markdown-extractor

型付き handler で AST から情報を集計する。core の依存は AST と共有宣言のみ。
文法、parser、renderer、codec、traQ 固有の集計型には依存しない。

```rust
use markdown_ast::{Document, Node, NodeData, Span};
use markdown_definitions::Plugin as Declaration;
use markdown_extractor::{Plugin, PresetBuilder, Extractor};

#[derive(Debug, Clone, PartialEq)]
struct Reference(String);
impl NodeData for Reference {}

let mut plugin = Plugin::<Vec<String>>::new(&Declaration::new("references"));
plugin.on::<Reference>(|reference, result| {
    result.push(reference.0.clone());
    Ok(())
})?;
let mut builder = PresetBuilder::new();
builder.add(&plugin)?;
let extractor = Extractor::new(&builder.build()?);
let document = Document {
    source: String::new(),
    children: vec![Node::leaf(Span { start: 0, end: 0 }, Reference("id".into()))],
};
assert_eq!(extractor.extract(&document)?, ["id"]);
# Ok::<(), &'static str>(())
```

集計型は `extract` で `Default` を要求し、呼び出しごとに新しく生成する。
同じ extractor の plugin は共通の集計型を使う。集計型に Clone / Send / Sync は要求しない。
handler のクロージャは Send + Sync で、preset と生成済み extractor 間で共有する。

Plugin → PresetBuilder → Preset → Extractor の所有権と add / remove は renderer と同様。
型別 handler の重複は拒否し、登録後の Plugin 編集は既存の構成を変更しない。
エラーコードは static str。失敗した抽出の途中結果は返さない。

全ノードを検証してから、文書順（親、子孫、次の兄弟）に一度ずつ handler を呼ぶ。
未登録の型も検証し、子孫を走査する。登録がなければ集計のみ省略する。
原文の再解析や renderer の表示結果からの抽出はしない。
検証上限は原文65,536 bytes、16,384 nodes、深さ64。
handler の処理や集計結果の大きさは、信頼する拡張コードの責務。
