# markdown-commonmark-contracts

CommonMark の17種類のノード型と、各型の NodeData 検証・serde 入出力・NodeType を所有する。
parser / renderer / codec の実装には依存しない。

ノード型は `#[derive(NodeType)]` で通信メタデータを持つ。
codec を構成する配布物は `codec.register::<Heading>()?` などで型を登録する。
ノード名・契約版・ノード宣言の一覧は保持しない。

`preset().plugin` と `preset().html` は parser / renderer が共有する Plugin の宣言。
同じ CommonMark group の下に一度だけ生成し、以後は同じ宣言を返す。
表示名は人間向けの説明に使い、同一性はインスタンスで判定する。
文法の認識や表示方針は含まない。同じノード型を CommonMark 構成と traQ 互換構成で共有できる。
