import type { EditorLine, EditorRange } from './index.js'

/** One replacement in the original UTF-16 source. Edits are ordered and disjoint. */
export interface TextEdit extends EditorRange {
  readonly text: string
}

export interface ListCompletion extends EditorRange {
  readonly text: string
  readonly continuation: string
  readonly child: string
}

export interface EditPlan {
  readonly changes: readonly TextEdit[]
  /** Selection in the source after applying every change. */
  readonly selection: EditorRange
  readonly completion?: ListCompletion
}

export interface LineBreakOptions {
  readonly analyze: (
    source: string
  ) => Readonly<{ lines: readonly EditorLine[] }>

  readonly continueItem?: boolean
}

const nextMarker = (marker: string, child = false) => {
  const ordered = /^(\d+)([.)])$/.exec(marker)

  return ordered
    ? `${child ? 1 : Math.min(999999999, Number(ordered[1]) + 1)}${ordered[2]}`
    : marker
}

const checkedSelection = (source: string, selection: EditorRange) => {
  const boundary = (value: number) =>
    Number.isInteger(value) &&
    value >= 0 &&
    value <= source.length &&
    !(
      value > 0 &&
      value < source.length &&
      /[\uD800-\uDBFF]/.test(source[value - 1] ?? '') &&
      /[\uDC00-\uDFFF]/.test(source[value] ?? '')
    )
  if (
    !boundary(selection.from) ||
    !boundary(selection.to) ||
    selection.from > selection.to
  ) {
    throw new RangeError('Invalid source selection')
  }
}

const freeze = (plan: EditPlan): EditPlan =>
  Object.freeze({
    ...plan,
    changes: Object.freeze(plan.changes.map(change => Object.freeze(change))),
    selection: Object.freeze(plan.selection),
    ...(plan.completion ? { completion: Object.freeze(plan.completion) } : {})
  })

const lineStart = (source: string, position: number) => {
  let start = position

  while (
    start > 0 &&
    source[start - 1] !== '\n' &&
    source[start - 1] !== '\r'
  ) {
    start--
  }

  return start
}

const lineEnd = (source: string, position: number) => {
  let end = position

  while (end < source.length && source[end] !== '\n' && source[end] !== '\r') {
    end++
  }

  return end
}

/** Decide Markdown continuation without depending on a DOM or transaction API. */
export function planLineBreak(
  source: string,
  selection: EditorRange,
  options: LineBreakOptions
): EditPlan {
  checkedSelection(source, selection)
  let { from, to } = selection
  const newline = /\r\n|\r|\n/.exec(source)?.[0] ?? '\n'
  let text = newline
  let completion: ListCompletion | undefined

  if (from === to) {
    const start = lineStart(source, from)
    const end = lineEnd(source, from)

    const current = options
      .analyze(source)
      .lines.find(line => line.from === start)

    // Empty continuations can lie outside a completed block's span. Probe with
    // one ordinary character so the parser decides the active containers.
    const probe = /^[ \t]*$/.test(
      source.slice(current?.contentFrom ?? start, end)
    )
      ? source.slice(0, from) + '\uFFFC' + source.slice(from)
      : source

    const context = options
      .analyze(probe)
      .lines.find(line => line.from === start)

    if (context?.containers.length && from >= context.contentFrom) {
      const continuation = context.containers.map(part => part.continuation)
      const body = source.slice(context.contentFrom, end)
      const last = context.containers.at(-1)

      if (
        !context.literal &&
        body.trim() === '' &&
        !(options.continueItem && last?.kind === 'list')
      ) {
        const outer = continuation.slice(0, -1).join('')
        from = start
        to = end
        text = outer + newline + outer
      } else {
        if (!context.literal && last?.list && !options.continueItem) {
          const { marker, leading, spacing } = last.list

          const prefix =
            continuation.slice(0, -1).join('') +
            leading +
            nextMarker(marker) +
            spacing

          text += prefix

          if (source.slice(selection.from, end).trim() === '') {
            completion = {
              from: from + newline.length,
              to: from + text.length,
              text: prefix,
              continuation: continuation.join(''),
              child: continuation.join('') + nextMarker(marker, true) + spacing
            }
          }
        } else {
          text += continuation.join('')
        }

        if (context.literal) text += /^[ \t]*/.exec(body)?.[0] ?? ''
      }
    }
  }

  return freeze({
    changes: [{ from, to, text }],
    selection: { from: from + text.length, to: from + text.length },
    ...(completion ? { completion } : {})
  })
}

/** Indent or outdent source lines; all offsets refer to the unmodified source. */
export function planIndent(
  source: string,
  selection: EditorRange,
  direction: 'indent' | 'outdent' = 'indent',
  width = 2
): EditPlan {
  checkedSelection(source, selection)

  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError('Indent width must be positive')
  }

  const spaces = ' '.repeat(width)
  const changes: TextEdit[] = []

  if (selection.from === selection.to && direction === 'indent') {
    return freeze({
      changes: [{ ...selection, text: spaces }],
      selection: { from: selection.from + width, to: selection.to + width }
    })
  }

  const finish =
    selection.to === selection.from ? selection.to : selection.to - 1

  for (let start = lineStart(source, selection.from); start <= finish;) {
    if (direction === 'indent') {
      changes.push({ from: start, to: start, text: spaces })
    } else {
      let remove = source[start] === '\t' ? 1 : 0

      if (!remove) {
        while (remove < width && source[start + remove] === ' ') remove++
      }

      if (remove) changes.push({ from: start, to: start + remove, text: '' })
    }

    const end = lineEnd(source, start)
    if (end === source.length) break

    start = end + (source.slice(end, end + 2) === '\r\n' ? 2 : 1)
  }

  const map = (position: number) => {
    let offset = 0

    for (const change of changes) {
      if (position < change.from) break

      if (position <= change.to) {
        return change.from + offset + change.text.length
      }

      offset += change.text.length - (change.to - change.from)
    }

    return position + offset
  }

  return freeze({
    changes,
    selection: { from: map(selection.from), to: map(selection.to) }
  })
}
