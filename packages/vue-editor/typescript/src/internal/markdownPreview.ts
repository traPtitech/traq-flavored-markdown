import { Plugin } from '@tiptap/pm/state'
import { DecorationSet } from '@tiptap/pm/view'

import { markdownPreviewEvents } from './markdownPreviewEvents.js'
import { markdownPreviewState } from './markdownPreviewReducer.js'
import {
  type PreviewState,
  markdownPreviewKey
} from './markdownPreviewState.js'
import { restoreMarkdownSourceCaret } from './markdownSelection.js'

export { markdownPreviewKey } from './markdownPreviewState.js'

export const markdownPreview = () =>
  new Plugin<PreviewState>({
    key: markdownPreviewKey,
    state: markdownPreviewState,
    view: () => ({
      update: (view, previousState) => {
        const preview = markdownPreviewKey.getState(view.state)

        const startingComposition =
          preview?.composing &&
          !markdownPreviewKey.getState(previousState)?.composing

        if (
          preview?.enabled &&
          !view.composing &&
          (!preview.composing || startingComposition)
        )
          restoreMarkdownSourceCaret(view)
      }
    }),

    props: {
      ...markdownPreviewEvents,
      decorations: state => {
        const preview = markdownPreviewKey.getState(state)
        if (!preview?.enabled) return DecorationSet.empty

        return preview.compositionDecorations ?? preview.decorations
      }
    }
  })
