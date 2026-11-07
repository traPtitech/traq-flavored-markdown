import { Extension, Node, extensions } from '@tiptap/core'
import type { SourceAnalysis } from '@traq-flavored-markdown/sdk/editor'

import type { InputPart, MarkdownServices } from '../types.js'
import { compositionSafeShortcuts } from './composition.js'
import { inputHistoryExtension } from './inputHistory.js'
import { inputLifecycleExtension } from './inputLifecycle.js'
import { markdownExtension } from './markdownExtension.js'
import { markdownServicesPlugin } from './markdownServices.js'
import { messageExtension } from './messageExtension.js'
import { referenceNode } from './referenceNode.js'

export type { ReferenceInputHandle } from '../types.js'
export { partsToContent, contentToParts } from './editorDocument.js'
export const inputExtensions = <R>({
  label,
  editText,
  singleLine = false,
  isComposing,
  markdown,
  normalize
}: {
  label: (reference: R) => string
  editText?: (reference: R) => string
  singleLine?: boolean
  isComposing?: () => boolean
  markdown?: MarkdownServices
  normalize?: (
    parts: readonly InputPart<R>[],
    analysis?: SourceAnalysis
  ) => InputPart<R>[]
}) => [
  extensions.Keymap.extend({
    addKeyboardShortcuts() {
      return compositionSafeShortcuts(this.parent?.() ?? {}, isComposing)
    }
  }),
  Node.create({ name: 'doc', topNode: true, content: 'paragraph' }),
  Node.create({
    name: 'paragraph',
    content: 'inline*',
    group: 'block',
    code: true,
    whitespace: 'pre',
    parseHTML: () => [{ tag: 'p' }],
    renderHTML: () => ['p', 0]
  }),
  Node.create({ name: 'text', group: 'inline' }),
  referenceNode(label, isComposing, editText),
  inputHistoryExtension(isComposing),
  inputLifecycleExtension,
  ...(markdown
    ? [
        Extension.create({
          name: 'markdownServices',
          priority: 1000,
          addProseMirrorPlugins: () => [markdownServicesPlugin(markdown)]
        })
      ]
    : []),
  ...(!singleLine && markdown ? [markdownExtension] : []),
  ...(normalize
    ? [
        messageExtension.configure({
          normalize: (parts, analysis) =>
            normalize(parts as InputPart<R>[], analysis)
        })
      ]
    : [])
]
