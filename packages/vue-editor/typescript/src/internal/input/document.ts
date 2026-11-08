import type { Editor, JSONContent } from '@tiptap/core'
import type { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model'

import type { InputPart } from '../../types.js'
import type { ReferenceCodec } from '../../types.js'
import { editInput } from './editOperation.js'
import { inputHistory } from './history.js'

export const partsToInlineContent = <R>(
  parts: readonly InputPart<R>[]
): JSONContent[] =>
  parts.flatMap<JSONContent>(part => {
    if (part.type === 'text') {
      return part.text ? [{ type: 'text', text: part.text }] : []
    }

    return [
      {
        type: 'reference',
        attrs: {
          reference: part.reference,
          source: part.originalSource ?? null
        }
      }
    ]
  })

export const partsToContent = <R>(
  parts: readonly InputPart<R>[]
): JSONContent => ({
  type: 'doc',

  content: [
    {
      type: 'paragraph',

      content: partsToInlineContent(parts)
    }
  ]
})

export const sourceToContent = <R>(source: string, codec: ReferenceCodec<R>) =>
  partsToContent(codec.parse(source))

export const contentToParts = <R = unknown>(
  doc: ProseMirrorNode | Fragment
): InputPart<R>[] => {
  const parts: InputPart<R>[] = []

  doc.descendants(node => {
    if (node.isText) parts.push({ type: 'text', text: node.text ?? '' })
    else if (node.type.name === 'reference')
      parts.push({
        type: 'reference',
        reference: node.attrs['reference'],
        originalSource: node.attrs['source'] ?? undefined
      })
  })

  return parts
}

export const readInputDocument = <R>(
  editor: Editor,
  codec: ReferenceCodec<R>
) => codec.serialize(contentToParts<R>(editor.state.doc))

export const loadInputDocument = <R>(
  editor: Editor,
  source: string,
  force = false,
  codec: ReferenceCodec<R>
) => {
  if (!force && source === readInputDocument(editor, codec)) return false

  editor.commands.setContent(sourceToContent(source, codec), {
    emitUpdate: false
  })

  if (inputHistory.spec.key) editor.unregisterPlugin(inputHistory.spec.key)
  editor.registerPlugin(inputHistory)
  return true
}

export const replaceInputDocument = <R>(
  editor: Editor,
  source: string,
  codec: ReferenceCodec<R>
) => {
  if (source === readInputDocument(editor, codec)) return false

  const next = editor.schema.nodeFromJSON(sourceToContent(source, codec))
  const from = editor.state.doc.content.findDiffStart(next.content)
  const end = editor.state.doc.content.findDiffEnd(next.content)
  if (from === null || !end) return false

  const overlap = from - Math.min(end.a, end.b)
  const to = end.a + Math.max(0, overlap)
  const nextTo = end.b + Math.max(0, overlap)

  editInput(editor, () => {
    const transaction = editor.state.tr.replaceWith(
      from,
      to,
      next.slice(from, nextTo).content
    )

    editor.view.dispatch(transaction.setMeta('preventUpdate', true))
  })

  return true
}
