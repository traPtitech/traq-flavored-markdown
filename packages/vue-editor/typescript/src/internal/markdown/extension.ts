import { Extension } from '@tiptap/core'

import { markdownListInput } from './listInput.js'
import { markdownPreview } from './preview.js'

export const markdownExtension = Extension.create({
  name: 'markdownInput',
  addProseMirrorPlugins: () => [markdownListInput(), markdownPreview()]
})
