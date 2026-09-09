# traP reference extraction

`references::plugin()` は `ReferenceData` を収集する `Plugin<References>` を返します。
共有宣言は `markdown-trap-contracts` と同じインスタンスを使い、抽出 core は
`markdown-extractor` に任せます。parser・renderer・codec には依存しません。

`References` は `mentions` / `group_mentions` / `channel_links` の三つの配列を持ちます。
文書順と重複を保持し、不正な UUID は無視します。標準表記・ハイフンなし・波括弧・
`urn:uuid:` の表記を受け入れ、小文字の標準表記へ正規化します。
各 extract 呼び出しは新しい結果を返し、過去の結果を蓄積しません。

結果の Serialize は camelCase の JSON フィールド名を使います。
これは具体的な参照結果の出力であり、AST や抽出 core に JSON を要求しません。
実行例は [processing](https://github.com/traq-markdown-parser/traq/blob/main/crates/processing/examples/notification.rs) を参照してください。
