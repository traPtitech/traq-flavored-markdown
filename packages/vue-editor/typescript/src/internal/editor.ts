import { Extension, Node, extensions } from '@tiptap/core'
import type { SourceAnalysis } from '@traq-flavored-markdown/sdk/editor'

import type { InputPart, MarkdownServices } from '../types.js'
import { compositionSafeShortcuts } from './input/composition.js'
import { inputHistoryExtension } from './input/history.js'
import { inputLifecycleExtension } from './input/lifecycle.js'
import { referenceNode } from './input/referenceNode.js'
import { markdownExtension } from './markdown/extension.js'
import { markdownServicesPlugin } from './markdown/services.js'
import { messageExtension } from './messageExtension.js'

export type { ReferenceInputHandle } from '../types.js'
export { partsToContent, contentToParts } from './input/document.js'
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
