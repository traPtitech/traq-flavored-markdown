# markdown-definitions

parser と renderer が共有する plugin の宣言と、codec 用の型メタデータ。
parser / renderer / AST / serde には依存しない。derive の依存はコンパイル時だけに使う。

```rust
use markdown_definitions::{NodeType, Plugin};

#[derive(NodeType)]
struct Issue { number: u32 }

let generic = Plugin::group("Generic");
let github = generic.group("GitHub");
let links = github.new("Links");
assert_eq!(links.name(), "Links");
assert_eq!(links.namespace(), Some(&github));
assert_eq!(github.parent(), Some(&generic));
```

Plugin / PluginGroup の引数は必須の表示名。ID ではなく、通信キーの生成にも使わない。
同一性はインスタンスで判定する。同名の別インスタンスは同一ではない。
同じ group を使い回して子を作成でき、呼び出し側で clone する必要はない。
内部では親を共有所有するため、親の変数がスコープを抜けても階層を保持する。
Plugin.namespace() と PluginGroup.parent() は親の共有宣言を借用する。
ルートでは None を返す。表示名の連結を ID として利用する API ではない。
構成内の表示名の重複検査は、登録先の builder が共通関数 `validate_names` を呼んで行う。
Plugin 作成者が検査を定義したり、利用者が明示的に呼んだりする必要はない。

独自の builder を実装する場合は、採用した共有宣言の参照を `validate_names(plugins)?` に渡す。
その宣言と祖先 group だけを検査し、同じ親で同じ表示名を使う Plugin / group を拒否する。
異なる親の同名は許可する。名前のスラッシュを階層として解釈しない。
失敗時の `NameCollision { scope, name }` は人間向けの表示情報で、同一性の判定には使わない。
rule 名・handler 型・実装インスタンスの重複検査は、各 builder の責務。

`#[derive(NodeType)]` は型の定義モジュールと名前から通信メタデータを生成する。
型引数・const 引数を区別し、alias / re-export / Plugin の表示名・登録順には依存しない。
型引数にも NodeType が必要。基本型、String、Vec、Option、Box、配列の実装を提供する。
型名・crate 名・定義モジュールを変更するとキーも変わる。長期保存用の安定 ID ではない。
同一パスの異なる型などによるキーの衝突は codec 登録時に拒否する。
キーの一致だけで payload の構造・意味の互換性が保証されるわけではない。

ノード型に `NodeData` を実装すればネイティブ AST として利用できる。
codec を使う型はさらに NodeType と serde を実装し、`codec.register::<Issue>()?` で登録する。
通信メタデータは AST core に持ち込まない。ノード名・契約版・Plugin へのノード宣言は不要。
