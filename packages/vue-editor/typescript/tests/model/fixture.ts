import { Editor } from '@tiptap/core'
import { afterEach } from 'vitest'

import { inputExtensions } from '../../src/internal/editor.js'
import {
  readInputDocument,
  sourceToContent
} from '../../src/internal/input/document.js'
import { markdownServices } from '../helpers/markdown.js'
import { type TestReference, referenceCodec } from '../helpers/references.js'

const editors: Editor[] = []
export const createInputEditor = (
  source: string,
  options: Partial<Parameters<typeof inputExtensions<TestReference>>[0]> = {}
) => {
  const editor = new Editor({
    extensions: inputExtensions({
      label: reference => reference.label,
      markdown: markdownServices,
      normalize: referenceCodec.normalize,
      ...options
    }),
    content: sourceToContent(source, referenceCodec),
    enableCoreExtensions: { keymap: false },
    enableInputRules: false,
    enablePasteRules: false,
    editorProps: { handleScrollToSelection: () => true }
  })
  editors.push(editor)
  return editor
}
export const readSource = (editor: Editor) =>
  readInputDocument(editor, referenceCodec)
export const pressKey = (
  editor: Editor,
  key: string,
  options: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  })
  editor.view.dom.dispatchEvent(event)
  return event
}
export const installInputEditorFixture = () =>
  afterEach(() => editors.splice(0).forEach(editor => editor.destroy()))
