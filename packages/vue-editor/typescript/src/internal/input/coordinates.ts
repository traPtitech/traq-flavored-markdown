import type { SourceRange } from '../../types.js'

declare const documentPosition: unique symbol
export type DocumentPosition = number & { readonly [documentPosition]: true }

export type DocumentRange = Readonly<{
  from: DocumentPosition
  to: DocumentPosition
}>

export const toDocumentPosition = (offset: number): DocumentPosition =>
  (offset + 1) as DocumentPosition

export const toEditorOffset = (position: number) => position - 1

export const documentRange = (range: SourceRange): DocumentRange => {
  if (
    !Number.isSafeInteger(range.from) ||
    !Number.isSafeInteger(range.to) ||
    range.from < 1 ||
    range.to < range.from
  ) {
    throw new RangeError('Invalid input document range')
  }

  return {
    from: range.from as DocumentPosition,
    to: range.to as DocumentPosition
  }
}

export const toDocumentRange = (range: SourceRange): DocumentRange =>
  documentRange({
    from: toDocumentPosition(range.from),
    to: toDocumentPosition(range.to)
  })
