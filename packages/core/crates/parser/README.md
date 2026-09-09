# markdown-parser

文法・ノード型・preset の一覧を持たない parser core。
ルールの実行、本文と原文位置の対応、区切りの処理、文法構築、処理量の制限を担当する。
CommonMark や traQ の文法、ノード契約、codec には依存しない。

```rust
use markdown_definitions::Plugin as Declaration;
use markdown_parser::{GrammarBuilder, NodeData, Parser, Plugin};

#[derive(Debug, Clone, PartialEq)]
struct Text(String);
impl NodeData for Text {}

let declaration = Declaration::new("text");
let mut plugin = Plugin::new(&declaration);
plugin.text(Text);
let mut builder = GrammarBuilder::new();
builder.add(&plugin)?;
let parser = Parser::new(&builder.build()?);
let document = parser.parse_inline("hello")?;
assert_eq!(document.children[0].get::<Text>(), Some(&Text("hello".into())));
# Ok::<(), Box<dyn std::error::Error>>(())
```

Plugin は共有宣言から実装を作る。表示名と親 group を借用で参照し、内部で共有所有する。
登録後に実装を編集すると新しい snapshot になり、既存 Grammar / Parser は変わらない。
通常テキストの生成関数は一つ必要。ノードに serde や codec の登録は要求しない。
完成したノードは NodeData.validate() と原文 span・深さ・個数の制限で検証する。

`bindings::Catalog` は配布側が利用する。plugin(&plugin) で実装、preset(&builder) で構成を登録する。
preset は構成を検証して Result を返す。登録で dispatch table の構築や本文解析は行わない。
数値の返り値は生成 binding が持つ内部参照で、永続 ID ではない。
通常のアプリケーションは配布 package の preset インスタンスを利用する。
serde / serde_json はエラーと binding 構成の入出力に使用する。AST の JSON 化は codec の責務。

公開 TS / Go SDK の Wasm は、この core を文法配布層から利用する。

第三者由来のアルゴリズムの通知は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照。
