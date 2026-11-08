import type { Editor } from '@tiptap/core'
import type { EditorProps, EditorView } from '@tiptap/pm/view'

import { partsToDisplayText } from '../../projection.js'
import type { InputPart } from '../../types.js'
import type { PreparePaste, ReferenceInputAdapter } from '../../types.js'
import { type DocumentRange, documentRange } from './coordinates.js'
import { contentToParts } from './document.js'
import { editInput } from './editOperation.js'
import { currentInputSelection } from './selection.js'
import { editorTextBetween } from './text.js'

export type { PastePlan, PreparePaste } from '../../types.js'

export const inputDataTransfer = <R>(options: {
  editor: () => Editor | undefined
  readonly: () => boolean
  singleLine: () => boolean
  label: (reference: R) => string
  clipboard?: ReferenceInputAdapter<R>['clipboard']

  insertParts: (parts: InputPart<R>[], range?: DocumentRange) => void

  insertText: (text: string, range?: DocumentRange) => void
  preparePaste?: PreparePaste
}): NonNullable<EditorProps['handleDOMEvents']> => {
  const read = (data: Pick<DataTransfer, 'getData'>) =>
    options.clipboard?.read(data)

  const edit = (operation: () => void) => {
    const current = options.editor()
    if (!current || options.readonly()) return

    editInput(current, operation)
  }

  const copy = (view: EditorView, event: ClipboardEvent, cut: boolean) => {
    if (!event.clipboardData) return false

    const selection = currentInputSelection(view)
    if (selection.empty) return false

    const parts = contentToParts<R>(selection.content().content)

    if (options.clipboard) {
      options.clipboard.write(event.clipboardData, parts)
    } else {
      event.clipboardData.setData(
        'text/plain',
        partsToDisplayText(parts, options.label)
      )
    }

    event.preventDefault()

    if (cut && !options.readonly()) {
      edit(() =>
        view.dispatch(
          view.state.tr
            .setSelection(selection)
            .deleteSelection()
            .scrollIntoView()
        )
      )
    }

    return true
  }

  return {
    copy: (view, event) => copy(view, event, false),
    cut: (view, event) => copy(view, event, true),

    paste: (view, event) => {
      const data = event.clipboardData

      if (!data || options.readonly()) return false

      const { doc } = view.state
      const { from, to } = currentInputSelection(view)
      const range = documentRange({ from, to })

      const parts =
        read(data) ??
        (!options.singleLine() && !data.files?.length
          ? options.clipboard?.fromText?.(
              data.getData('text/plain'),
              editorTextBetween(doc, 1, from),
              editorTextBetween(doc, to)
            )
          : undefined)

      if (parts) {
        event.preventDefault()
        edit(() => options.insertParts(parts, range))

        return true
      }

      const plan = options.preparePaste?.(event)

      if (plan) {
        event.preventDefault()
        if (plan.type === 'handled') return true

        const insert = (text: string) => {
          if (!text) return

          const current = options.editor()

          if (
            current &&
            !current.isDestroyed &&
            current.view === view &&
            view.state.doc === doc
          ) {
            edit(() => options.insertText(text, range))
          }
        }

        if (typeof plan.text === 'string') {
          insert(plan.text)
        } else {
          void plan.text.then(insert).catch(() => undefined)
        }

        return true
      }

      event.preventDefault()
      const text = data.getData('text/plain')
      if (text) edit(() => options.insertText(text, range))

      return true
    },

    drop: (view, event) => {
      if (
        view.dragging ||
        options.readonly() ||
        !event.dataTransfer?.types.includes('text/plain')
      ) {
        return false
      }

      const position = view.posAtCoords({
        left: event.clientX,
        top: event.clientY
      })?.pos

      if (position === undefined) return false

      const range = documentRange({ from: position, to: position })
      event.preventDefault()

      const parts = read(event.dataTransfer)

      if (parts) {
        edit(() => options.insertParts(parts, range))
      } else {
        const text = event.dataTransfer.getData('text/plain')
        edit(() => options.insertText(text, range))
      }

      return true
    }
  }
}
