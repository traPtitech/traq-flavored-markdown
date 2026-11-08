export type HtmlEdit = Readonly<{ start: number; end: number; value: string }>

/** Decline overlapping or invalid source ranges before applying any replacement. */
export function applyHtmlEdits(
  source: string,
  edits: readonly HtmlEdit[]
): string | undefined {
  const parts: string[] = []
  let end = 0

  for (const edit of [...edits].sort(
    (left, right) => left.start - right.start
  )) {
    if (
      !Number.isSafeInteger(edit.start) ||
      !Number.isSafeInteger(edit.end) ||
      edit.start < end ||
      edit.end < edit.start ||
      edit.end > source.length
    ) {
      return undefined
    }

    parts.push(source.slice(end, edit.start), edit.value)
    end = edit.end
  }

  parts.push(source.slice(end))
  return parts.join('')
}
