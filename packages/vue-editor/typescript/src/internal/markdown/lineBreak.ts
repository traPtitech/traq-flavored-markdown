import type { EditorState } from '@tiptap/pm/state'
import { planLineBreak } from '@traq-flavored-markdown/sdk/editor'

import type { MarkdownLineBreakOptions } from '../../types.js'
import { toDocumentPosition, toEditorOffset } from '../input/coordinates.js'
import { editorTextBetween } from '../input/text.js'
import { analyzeEditorProbe } from './analysis.js'
import { markdownListInputKey } from './listInput.js'
import { applyMarkdownEdit } from './operations.js'
import { getMarkdownServices } from './services.js'

export type { MarkdownLineBreakOptions } from '../../types.js'
export const markdownLineBreak = (
  state: EditorState,
  options: MarkdownLineBreakOptions = {}
) => {
  const source = editorTextBetween(state.doc)
  const plan = planLineBreak(
    source,
    {
      from: Math.max(0, toEditorOffset(state.selection.from)),
      to: Math.min(source.length, toEditorOffset(state.selection.to))
    },
    {
      ...options,
      analyze: source =>
        analyzeEditorProbe(
          state.doc,
          source,
          getMarkdownServices(state)!.analyze
        )
    }
  )
  const transaction = applyMarkdownEdit(state, plan)
  if (plan.completion)
    transaction.setMeta(markdownListInputKey, {
      ...plan.completion,
      from: toDocumentPosition(plan.completion.from),
      to: toDocumentPosition(plan.completion.to)
    })
  return transaction
}
