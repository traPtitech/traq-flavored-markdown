import { Extension } from '@tiptap/core'

import { markdownListInput } from './markdownListInput.js'
import { markdownPreview } from './markdownPreview.js'

export const markdownExtension = Extension.create({
  name: 'markdownInput',
  addProseMirrorPlugins: () => [markdownListInput(), markdownPreview()]
})
