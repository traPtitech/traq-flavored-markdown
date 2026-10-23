import { type DifferenceRow, isFailure } from '../protocol/comparison.ts'

const withoutWhitespace = (value: string) => value.replace(/[ \t\r\n\f]/g, '')

export function isWhitespaceOnlyDifference({
  before,
  after
}: Pick<DifferenceRow, 'before' | 'after'>) {
  return (
    !isFailure(before) &&
    !isFailure(after) &&
    before.kind === after.kind &&
    withoutWhitespace(before.value) === withoutWhitespace(after.value)
  )
}
