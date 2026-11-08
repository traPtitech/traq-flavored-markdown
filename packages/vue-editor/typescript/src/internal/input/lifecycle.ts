import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { transactionMetadata } from './metadata.js'

export type InputRuntimeState = {
  composing: boolean
  focused: boolean
  markdown: boolean
}

export const inputLifecycleKey = new PluginKey<InputRuntimeState>(
  'inputLifecycle'
)

export const inputLifecycleMetadata =
  transactionMetadata<Partial<InputRuntimeState>>(inputLifecycleKey)

export const inputLifecycleExtension = Extension.create({
  name: 'inputLifecycle',
  priority: 1000,

  addProseMirrorPlugins: () => [
    new Plugin<InputRuntimeState>({
      key: inputLifecycleKey,
      state: {
        init: () => ({ composing: false, focused: false, markdown: false }),

        apply: (transaction, previous) => ({
          ...previous,
          ...inputLifecycleMetadata.get(transaction)
        })
      }
    })
  ]
})
