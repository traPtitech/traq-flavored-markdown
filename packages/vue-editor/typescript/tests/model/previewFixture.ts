import type { Editor } from '@tiptap/core'

import { inputLifecycleKey } from '../../src/internal/input/lifecycle.js'
import type { TestReference } from '../helpers/references.js'
import { createInputEditor } from './fixture.js'

export const create = (
  source: string,
  multiline = true,
  label = (reference: TestReference) => reference.label
) => createInputEditor(source, { singleLine: !multiline, label })

export const configure = (
  editor: Editor,
  options: { enabled?: boolean; focused?: boolean; composing?: boolean }
) => {
  const { enabled: markdown, ...lifecycle } = options

  editor.view.dispatch(
    editor.state.tr.setMeta(inputLifecycleKey, {
      ...lifecycle,
      ...(markdown === undefined ? {} : { markdown })
    })
  )
}
