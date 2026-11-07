import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import type { ReferenceCodec } from '../types.js'
import { analyzeEditorDocument } from './documentAnalysis.js'
import { contentToParts } from './editorDocument.js'
import { inputLifecycleKey } from './inputLifecycle.js'
import { getMarkdownServices } from './markdownServices.js'

export const messageExtension = Extension.create<{
  normalize: NonNullable<ReferenceCodec<unknown>['normalize']>
}>({
  name: 'messageReferences',
  addOptions: () => ({ normalize: parts => [...parts] }),
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, state) => {
          if (inputLifecycleKey.getState(state)?.composing) return null

          const compositionEnded = transactions.some(
            tr => tr.getMeta(inputLifecycleKey)?.composing === false
          )

          if (!compositionEnded && !transactions.some(tr => tr.docChanged))
            return null

          const parts = contentToParts(state.doc)
          const normalized = this.options.normalize(
            parts,
            parts.some(part => part.type === 'reference') &&
              getMarkdownServices(state)
              ? analyzeEditorDocument(
                  state.doc,
                  getMarkdownServices(state)!.analyze
                )
              : undefined
          )
          const tr = state.tr
          let index = 0

          state.doc.descendants((node, pos) => {
            if (!node.isInline) return

            const next = normalized[index++]

            if (node.type.name === 'reference' && next?.type === 'text')
              tr.replaceWith(
                tr.mapping.map(pos),
                tr.mapping.map(pos + node.nodeSize),
                state.schema.text(next.text)
              )
          })

          return tr.docChanged ? tr : null
        }
      })
    ]
  }
})
