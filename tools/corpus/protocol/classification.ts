/** Append new rules; changing an existing bit or its meaning requires a new version. */
export const classificationVersion = '1'

export const classificationGroups = {
  image: '画像',
  link: '自動リンク',
  reference: '参照と入れ子リンク',
  stamp: '色スタンプ',
  math: '数式',
  block: 'ブロック構造',
  html: 'HTMLの表記',
  text: 'テキストの表記',
  error: '処理失敗・出力種別'
} as const

type Rule = {
  id: string
  group: keyof typeof classificationGroups
  title: string
  description: string
  decision: 'accepted' | 'review'
  reason: string
}

export const classificationRules = [
  {
    id: 'image.linked',
    group: 'image',
    title: 'リンク付き画像の代替表示',
    description:
      '画像を表示しないとき、外側の宛先を保った単一のリンクへ変わる。',
    decision: 'accepted',
    reason: '外側のリンク先を優先する既存の採用方針。'
  },
  {
    id: 'link.policy',
    group: 'link',
    title: '自動リンクの認識・範囲',
    description: '自動リンクに関する仕様変更。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターと同じ照合を使用。'
  },
  {
    id: 'reference.nested',
    group: 'reference',
    title: '入れ子リンクの解消',
    description: '外側の宛先とラベルを保ちながら、内側のリンク要素を取り除く。',
    decision: 'accepted',
    reason: '外側の宛先を優先する既存の採用方針。'
  },
  {
    id: 'stamp.hex_case',
    group: 'stamp',
    title: '16進色の表記',
    description: '色スタンプ内の 16 進色指定だけが大文字・小文字で異なる。',
    decision: 'review',
    reason: '色の値と表示ラベルの表記を分けて確認する。'
  },
  {
    id: 'stamp.hsl_spaces',
    group: 'stamp',
    title: 'HSLの空白',
    description: '色スタンプ内の HSL 指定でカンマ周囲の空白だけが変わる。',
    decision: 'review',
    reason: '色の値を保った表記変更。'
  },
  {
    id: 'math.diagnostic',
    group: 'math',
    title: '既存エラーの診断表示',
    description: '両側に同数の KaTeX エラーがあり、本文・診断titleが変わる。',
    decision: 'review',
    reason: '診断文に加えて数式入力の違いを含みうるため要確認。'
  },
  {
    id: 'math.regression',
    group: 'math',
    title: '数式エラーの増加',
    description: 'KaTeX エラー要素の数が増える。',
    decision: 'review',
    reason: '数式の認識や入力境界が変化していないか確認する。'
  },
  {
    id: 'math.recovery',
    group: 'math',
    title: '数式エラーの減少',
    description: 'KaTeX エラー要素の数が減る。',
    decision: 'review',
    reason: '描画成功への変化か、数式として認識されなくなったかを確認する。'
  },
  {
    id: 'block.breaks',
    group: 'block',
    title: '改行要素の増減・位置',
    description: 'br 要素を除くと同じ出力になる (テキスト中の改行とは区別)。',
    decision: 'review',
    reason: '実際の表示上の改行が変わるため要確認。'
  },
  {
    id: 'block.paragraph',
    group: 'block',
    title: '段落の包み方',
    description: 'p 要素を除くと同じ出力になる。',
    decision: 'review',
    reason: '段落構造と余白への影響を確認する。'
  },
  {
    id: 'block.quote',
    group: 'block',
    title: '引用の構造',
    description: 'blockquote 要素を除くと同じ出力になる。',
    decision: 'review',
    reason: '引用の範囲が変化している。'
  },
  {
    id: 'block.list',
    group: 'block',
    title: 'リストの構造',
    description:
      'ul・ol・li 要素を除くと同じ出力になる。属性が変わる例は残差として残す。',
    decision: 'review',
    reason: '項目の構造と段落境界を確認する。'
  },
  {
    id: 'block.heading',
    group: 'block',
    title: '見出しの構造',
    description: 'h1〜h6 要素を除くと同じ出力になる。',
    decision: 'review',
    reason: '見出しの認識範囲を確認する。'
  },
  {
    id: 'html.serialization',
    group: 'html',
    title: '属性順序・引用符・文字参照',
    description:
      'HTML 正規化により一致する表記の変更。href の HTTPS 補完も既存の規則に従う。',
    decision: 'accepted',
    reason: '既存のHTML表記フィルターと同じ正規化を使用。'
  },
  {
    id: 'text.whitespace',
    group: 'text',
    title: '空白・タブ・改行',
    description: '半角空白・タブ・改行・フォームフィードだけが変わる。',
    decision: 'review',
    reason: 'コードや属性値の空白も含みうるため、自動的には採用しない。'
  },
  {
    id: 'text.case',
    group: 'text',
    title: '大文字・小文字',
    description: '文字列の大文字・小文字だけが変わる。',
    decision: 'review',
    reason: '本文やURLの大小は意味を持ちうるため要確認。'
  },
  {
    id: 'error.after',
    group: 'error',
    title: '新実装のみ処理失敗',
    description: '旧実装は出力を返すが、新実装は処理エラーを返す。',
    decision: 'review',
    reason: '新たな処理失敗を確認する。'
  },
  {
    id: 'error.before',
    group: 'error',
    title: '旧実装のみ処理失敗',
    description: '旧実装は処理エラーを返すが、新実装は出力を返す。',
    decision: 'review',
    reason: '処理成功への変化と出力を確認する。'
  },
  {
    id: 'error.changed',
    group: 'error',
    title: 'エラー内容の変化',
    description: '両側が処理エラーで、内容が異なる。',
    decision: 'review',
    reason: '異なる失敗理由を確認する。'
  },
  {
    id: 'error.kind',
    group: 'error',
    title: '出力種別の変化',
    description: 'HTML とプレーンテキストの出力種別が変わる。',
    decision: 'review',
    reason: '比較する出力形式を確認する。'
  },
  {
    id: 'image.inline',
    group: 'image',
    title: 'インライン画像の代替リンク',
    description:
      '!付きの通常リンクから data-is-image を持つ画像用リンクへ変わる。宛先とラベルを保持して照合する。',
    decision: 'review',
    reason: '画像の代替表示とリンク属性の変更を確認する。'
  },
  {
    id: 'image.inline_linked',
    group: 'image',
    title: 'インラインのリンク付き画像',
    description:
      '外側のリンク先を保ったまま画像 alt をラベルにし、画像を表す ! を付けなくなる。',
    decision: 'review',
    reason: '通常表示とは異なるインライン用の代替表示を確認する。'
  },
  {
    id: 'block.numbering',
    group: 'block',
    title: 'インラインのリスト番号',
    description:
      '番号付きリストを含む入力で、コード・リンク以外の表示番号が変わる。',
    decision: 'review',
    reason: '入力の番号と表示上の連番の扱いを確認する。'
  },
  {
    id: 'link.domain',
    group: 'link',
    title: '裸のドメインのリンク化廃止',
    description: '原文と旧宛先を照合した、裸のドメイン風文字列のリンク化廃止。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'link.email',
    group: 'link',
    title: 'メールアドレスのリンク認識',
    description: '原文・mailto 宛先と照合したメールの自動リンク表現。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'link.angle',
    group: 'link',
    title: '山括弧によるリンク認識',
    description: 'スキームを省略した山括弧内のドメインのリンク表現。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'link.relative',
    group: 'link',
    title: 'HTTPS補完とリソース表示',
    description:
      '// で始まる URL の HTTPS 補完に伴うリンクやリソースラベル・カードの変化。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'link.boundary',
    group: 'link',
    title: 'URLの範囲・装飾との境界',
    description: '原文と宛先を照合した URL 末尾や角括弧・装飾との境界変更。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'link.url',
    group: 'link',
    title: 'スキーム付きURLのリンク認識',
    description: 'HTTP(S)・FTP URL の原文と宛先を照合した自動リンク表現。',
    decision: 'accepted',
    reason: '既存のリンク仕様変更フィルターの対象。'
  },
  {
    id: 'text.inline_spacing',
    group: 'text',
    title: 'インライン本文の空白',
    description:
      'インライン出力の通常テキストにある半角空白・改行だけが変わる。コード・リンク・スタンプ・属性値は保持して照合する。',
    decision: 'review',
    reason: 'ブロックを1行にまとめる際の空白や、本文の空白への影響を確認する。'
  }
] as const satisfies readonly Rule[]

export type ClassificationId = (typeof classificationRules)[number]['id']
export type Classification = { tags: ClassificationId[]; complete: boolean }

export type ClassificationSelection =
  | ClassificationId
  | keyof typeof classificationGroups
  | 'all'
  | 'residual'
  | 'unclassified'

export const classificationWidth = 16
const completeBit = 1n << 63n

if (classificationRules.length > 63) {
  throw new Error('Classification index capacity exceeded')
}

const allowedBits = (1n << BigInt(classificationRules.length)) - 1n
const rulesById = new Map(classificationRules.map(rule => [rule.id, rule]))

export const classificationKeys = [
  'all',
  'residual',
  'unclassified',
  ...Object.keys(classificationGroups),
  ...classificationRules.map(rule => rule.id)
]

export function classificationMemberships(value: Classification) {
  const ids = new Set<string>([
    'all',
    ...value.tags,
    ...value.tags.map(tag => rulesById.get(tag)!.group)
  ])

  if (!value.complete) ids.add('residual')
  if (!value.tags.length) ids.add('unclassified')

  return ids
}

export function encodeClassification(value: Classification) {
  let mask = value.complete ? completeBit : 0n

  for (const tag of value.tags) {
    const index = classificationRules.findIndex(rule => rule.id === tag)
    if (index < 0) throw new Error('Unknown classification: ' + tag)

    mask |= 1n << BigInt(index)
  }

  return mask.toString(16).padStart(classificationWidth, '0')
}

export function classificationAt(
  encoded: string,
  index: number
): Classification {
  const mask = BigInt(
    '0x' +
      encoded.slice(
        index * classificationWidth,
        (index + 1) * classificationWidth
      )
  )

  return {
    tags: classificationRules
      .filter((_, bit) => Boolean(mask & (1n << BigInt(bit))))
      .map(rule => rule.id),
    complete: Boolean(mask & completeBit)
  }
}

export function validClassifications(encoded: string, count: number) {
  if (
    encoded.length !== count * classificationWidth ||
    !/^[0-9a-f]*$/.test(encoded)
  ) {
    return false
  }

  for (let i = 0; i < count; i++) {
    const mask = BigInt(
      '0x' +
        encoded.slice(i * classificationWidth, (i + 1) * classificationWidth)
    )
    if (
      mask & ~(allowedBits | completeBit) ||
      (mask & completeBit && !(mask & allowedBits))
    ) {
      return false
    }
  }

  return true
}

export function needsReview(value: Classification) {
  return (
    !value.complete ||
    value.tags.some(tag => rulesById.get(tag)!.decision === 'review')
  )
}

export function matchesClassification(
  value: Classification,
  selection: string
) {
  if (selection === 'all') return true
  if (selection === 'residual') return !value.complete
  if (selection === 'unclassified') return value.tags.length === 0

  return value.tags.some(
    tag => tag === selection || rulesById.get(tag)!.group === selection
  )
}
