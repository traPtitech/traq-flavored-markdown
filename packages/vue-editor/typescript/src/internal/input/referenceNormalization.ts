import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

import type { ReferenceCodec } from '../../types.js'
import { analyzeEditorDocument } from '../markdown/analysis.js'
import { getMarkdownServices } from '../markdown/services.js'
import { contentToParts } from './document.js'
import { inputLifecycleKey, inputLifecycleMetadata } from './lifecycle.js'

export const referenceNormalizationExtension = Extension.create<{
  normalize: NonNullable<ReferenceCodec<unknown>['normalize']>
}>({
  name: 'referenceNormalization',
  addOptions: () => ({ normalize: () => [] }),

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, state) => {
          if (inputLifecycleKey.getState(state)?.composing) return null

          const compositionEnded = transactions.some(
            tr => inputLifecycleMetadata.get(tr)?.composing === false
          )

          if (!compositionEnded && !transactions.some(tr => tr.docChanged)) {
            return null
          }

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

          const replacements = new Map<number, string>()

          for (const { index, text } of normalized) {
            if (
              !Number.isSafeInteger(index) ||
              parts[index]?.type !== 'reference' ||
              typeof text !== 'string' ||
              replacements.has(index)
            ) {
              throw new TypeError('Invalid reference replacement plan')
            }

            replacements.set(index, text)
          }

          const tr = state.tr
          let index = 0

          state.doc.descendants((node, pos) => {
            if (!node.isInline) return

            const text = replacements.get(index++)
            if (text === undefined) return

            const from = tr.mapping.map(pos)
            const to = tr.mapping.map(pos + node.nodeSize)

            if (text) {
              tr.replaceWith(from, to, state.schema.text(text))
            } else {
              tr.delete(from, to)
            }
          })

          return tr.docChanged ? tr : null
        }
      })
    ]
  }
})
