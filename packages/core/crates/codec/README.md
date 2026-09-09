# markdown-codec

型付き AST と JSON の境界。`codec.register::<List>()?` のように型を登録した codec を再利用し、
`codec.encode(&document)` / `codec.decode(&json)` で変換する。
core に具体型の一覧はなく、配布物がノード型の組み合わせを登録する。
登録する型は NodeData、NodeType、Serialize、DeserializeOwned を実装する。
NodeType は共有定義の `#[derive(NodeType)]` で生成する。Plugin や明示 ID、契約版の指定は不要。

すべてのノードは `{ kind, span, data, children }` の共通形式を使う。
`children` は空の場合に省略する。data は契約側の struct を直接直列化し、
途中でノードごとの JSON Value を作らない。

入力は生成された型のキーから具体型へ復元し、`NodeData::validate` を呼ぶ。
未知の契約・包みの未知フィールド・重複フィールド・不正な原文位置は拒否する。
payload の未知フィールドの扱いは契約型の serde 定義で指定する。
一つの codec に同じ Rust 型または同じキーを重複登録できない。失敗しても既存の登録は変わらない。
キーは登録時だけ生成し、ノードごとの変換では登録済みの値を再利用する。

AST は原文から再生成する中間データ。型名や定義モジュールの変更をまたぐ互換性は保証しない。
producer / consumer は互換性のある共有定義と生成済み bindings を使う。
型のキーが一致しても、payload の形や意味が一致するとは限らない。

既定の制限は JSON 8 MiB、原文65,536 bytes、16,384 nodes、深さ64。
出力時も型・位置・資源制限を検査する。受信側では decode_with_limits で制限を指定できる。
文法版の選択や parser / renderer の保持・キャッシュは担当しない。

JSON に表せない値（非有限の f64 など）の扱いは、契約型の検証または serde 表現で定義する。
AST が PartialEq の型を保持できることと、その値が JSON で往復できることは別の条件。
