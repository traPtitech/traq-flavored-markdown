import { PluginKey } from '@tiptap/pm/state'
import type { Decoration, DecorationSet } from '@tiptap/pm/view'

import { transactionMetadata } from '../input/metadata.js'
import type { MarkdownEditingState } from './editing.js'
import type { MarkdownFormat } from './formats.js'

export type PreviewState = MarkdownEditingState & {
  compositionDecorations: DecorationSet | undefined
  decorations: DecorationSet

  decorationCache: Map<
    MarkdownFormat,
    { visible: boolean; active: boolean; decorations: Decoration[] }
  >

  anchor?: { position: number; side: number; decoration: Decoration }
  syntax: MarkdownFormat['content'][]
}

export const markdownPreviewKey = new PluginKey<PreviewState>('markdownPreview')

export const markdownPreviewMetadata =
  transactionMetadata<Partial<Pick<PreviewState, 'revealed'>>>(
    markdownPreviewKey
  )
