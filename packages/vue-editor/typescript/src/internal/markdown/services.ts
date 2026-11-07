import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'

import type { MarkdownServices } from '../../types.js'

export type { MarkdownServices } from '../../types.js'
const key = new PluginKey<MarkdownServices>('referenceInputMarkdown')

export const markdownServicesPlugin = (services: MarkdownServices) =>
  new Plugin({
    key,
    state: { init: () => services, apply: (_transaction, current) => current }
  })

export const getMarkdownServices = (state: EditorState) => key.getState(state)
