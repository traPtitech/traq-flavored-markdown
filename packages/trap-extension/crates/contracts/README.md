# markdown-trap-contracts

traQ 拡張のノード型を所有する契約パッケージ。ReferenceData、StampData、SpoilerData、
BlankLineData の 4 型と ReferenceKind を定義する。parser、renderer、codec には依存しない。

`preset()` は references / stamp / spoiler / compat の共有 Plugin 宣言を返す。
一つの trap group に一度だけ生成し、parser / renderer / extractor が同じインスタンスを使う。
実装を選択する文法・表示・抽出の preset とは別で、宣言自体に処理は登録しない。

payload の形と既存の検証規則を引き継ぐ。スタンプはまだ `literal` のみで、構造化 payload への
未承認の変更は含まない。文法・表示・通知先判定・URL の意味付けも別の実装が所有する。
`contracts` feature は既存の TS 型・JSON Schema 生成のためのオプション。

生成キーは、たとえば `markdown_trap_contracts::stamp::StampData`。
parser と renderer は同じ型定義を参照する。将来の別定義との AST 互換性を保証する ID ではない。
