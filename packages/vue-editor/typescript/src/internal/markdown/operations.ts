import { closeHistory } from '@tiptap/pm/history'
import { type EditorState, TextSelection } from '@tiptap/pm/state'
import type { EditPlan } from '@traq-flavored-markdown/sdk/editor'

import { toDocumentPosition } from '../input/coordinates.js'

export const createMarkdownTransaction = (
  state: EditorState,
  plan: EditPlan,
  preserveSelection = false
) => {
  const transaction = closeHistory(state.tr)

  for (const change of [...plan.changes].reverse()) {
    transaction.insertText(
      change.text,
      toDocumentPosition(change.from),
      toDocumentPosition(change.to)
    )
  }

  transaction.setSelection(
    preserveSelection
      ? state.selection.map(transaction.doc, transaction.mapping)
      : TextSelection.create(
          transaction.doc,
          toDocumentPosition(plan.selection.from),
          toDocumentPosition(plan.selection.to)
        )
  )

  return transaction.scrollIntoView()
}
