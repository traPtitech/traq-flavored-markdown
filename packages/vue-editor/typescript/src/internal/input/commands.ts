import type { Editor } from '@tiptap/core'

import type { InputPart } from '../../types.js'
import { type DocumentRange, documentRange } from './coordinates.js'
import { partsToInlineContent } from './document.js'

export function createInputCommands<R>(options: {
  editor: () => Editor | undefined
  readonly: () => boolean
  singleLine: () => boolean
}) {
  const insertParts = (
    parts: readonly InputPart<R>[],
    range?: DocumentRange,
    focus = true
  ) => {
    const editor = options.editor()
    if (!editor || editor.isDestroyed || options.readonly()) return

    const normalized = parts.map(part =>
      part.type === 'text' && options.singleLine()
        ? { ...part, text: part.text.replace(/[\r\n]+/g, ' ') }
        : part
    )

    const chain = editor.chain()
    if (focus) chain.focus()

    chain
      .insertContentAt(
        range ?? documentRange(editor.state.selection),
        partsToInlineContent(normalized),
        {
          parseOptions: { preserveWhitespace: 'full' }
        }
      )
      .run()
  }

  return {
    insertParts,
    insertText: (text: string, range?: DocumentRange, focus?: boolean) =>
      insertParts([{ type: 'text', text }], range, focus)
  }
}
