# markdown-ast

文法から独立した型付き AST。各ノードのデータと検証は、型を所有する契約 package が定義する。
この crate は標準ライブラリだけを使い、CommonMark の型一覧・serde・契約名を持たない。

```rust
use markdown_ast::{Node, NodeData, Span};

#[derive(Debug, Clone, PartialEq)]
struct Heading { level: u8 }

impl NodeData for Heading {
    fn validate(&self, _children: &[Node]) -> bool {
        (1..=6).contains(&self.level)
    }
}

let node = Node::leaf(Span { start: 0, end: 4 }, Heading { level: 2 });
assert_eq!(node.get::<Heading>().unwrap().level, 2);
assert!(node.validate());
```

`Node::new(span, data, children)` は具体型を直接受け取る。
`NodeKind` は parser が子や位置を確定する前にも保持できる、型を消去したデータの入れ物。
固定 enum ではなく、新しい型を追加しても core の変更は不要。
`node.get::<T>()` は保存された具体型を借用し、JSON 変換やコピーを行わない。

`NodeData::validate` は自身と直接の子の関係を検査し、既定は true。
完成した AST の全体検証は `document.validate(limits)` で行う。
`ValidationLimits { source_bytes, nodes, depth }` を受け取り、成功時は検証したノード数を返す。
原文サイズ、子孫全体の数・深さ、親の範囲内の UTF-8 span、各ノードの `NodeData::validate()` を検査する。
既定の上限は原文65,536バイト・16,384ノード・深さ64。変更した上限も指定できる。
失敗は `ValidationError` で返す。登録された codec や handler の有無は検査しない。
parser / renderer / extractor / codec の出力処理はこの検証を利用し、独自の制限やエラー形式を維持する。
codec の受信時は AST を構築する前にも入力を検査する。
検証結果はキャッシュしないため、後から AST を編集した場合は再検証する。
生成や編集の操作自体は検証を行わない。

`Node` / `Document` は Clone・PartialEq・Send・Sync に対応する。Eq は要求しない。
浮動小数点数なども保持できるが、NaN を含む場合は clone との比較も false になり得る。
JSON 入出力は別の codec が担当し、Document 自体は Serialize / Deserialize を実装しない。
