import { expect, it, vi } from 'vitest'

import * as markdown from '../helpers/markdown.js'
import {
  analyzeEditorDocument,
  analyzeEditorProbe
} from '../../src/internal/documentAnalysis.js'
import { createInputEditor, installInputEditorFixture } from './fixture.js'

installInputEditorFixture()

it('shares one analysis per document and keeps completion probes separate', () => {
  const first = createInputEditor('**first**').state.doc
  const second = createInputEditor('**second**').state.doc
  const parse = vi.fn(markdown.analyzeMarkdownSource)

  try {
    const analysis = analyzeEditorDocument(first, parse)
    analyzeEditorDocument(second, parse)
    const probe = analyzeEditorProbe(first, '**first** :test:', parse)

    expect(analyzeEditorDocument(first, parse)).toBe(analysis)
    expect(analyzeEditorProbe(first, '**first**', parse)).toBe(analysis)
    expect(analyzeEditorProbe(first, '**first** :test:', parse)).toBe(probe)
    expect(parse).toHaveBeenCalledTimes(3)
  } finally {
    parse.mockRestore()
  }
})

it('does not reuse an analysis from another host for the same ProseMirror document', () => {
  const doc = createInputEditor('**shared**').state.doc
  const first = vi.fn(markdown.analyzeMarkdownSource)
  const second = vi.fn(markdown.analyzeMarkdownSource)
  const a = analyzeEditorDocument(doc, first)
  const b = analyzeEditorDocument(doc, second)
  expect(a).not.toBe(b)
  expect(analyzeEditorProbe(doc, '**shared**', first)).toBe(a)
  expect(analyzeEditorProbe(doc, '**shared**', second)).toBe(b)
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
})
