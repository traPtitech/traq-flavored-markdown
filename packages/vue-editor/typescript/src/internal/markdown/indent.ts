import type { EditorState } from '@tiptap/pm/state'
import { planIndent } from '@traq-flavored-markdown/sdk/editor'

import { toEditorOffset } from '../input/coordinates.js'
import { editorTextBetween } from '../input/text.js'
import { createMarkdownTransaction } from './operations.js'

export const markdownIndent = (
  state: EditorState,
  direction: 'indent' | 'outdent' = 'indent'
) => {
  const source = editorTextBetween(state.doc)

  const plan = planIndent(
    source,
    {
      from: Math.max(0, toEditorOffset(state.selection.from)),
      to: Math.min(source.length, toEditorOffset(state.selection.to))
    },
    direction
  )

  return createMarkdownTransaction(
    state,
    plan,
    !(state.selection.empty && direction === 'indent')
  )
}
