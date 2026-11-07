import { expect, it } from 'vitest'

import * as integration from '../src/prosemirror.js'

it('exposes only the helpers needed by host completion controllers', () => {
  expect(Object.keys(integration).sort()).toEqual([
    'analyzeEditorProbe',
    'editInput',
    'editorTextBetween'
  ])
})
