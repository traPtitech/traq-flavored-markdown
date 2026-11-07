import type { Node } from '@tiptap/pm/model'

import type { ProjectedInputAnalysis } from '../projection.js'
import { editorTextBetween } from './editorText.js'
import type { MarkdownServices } from './markdownServices.js'

type DocumentAnalysis = {
  editorText: string
  analysis?: ProjectedInputAnalysis
  probe?: ProjectedInputAnalysis
}

type Analyzer = MarkdownServices['analyze']
const analyzers = new WeakMap<Analyzer, WeakMap<Node, DocumentAnalysis>>()

const documentAnalysis = (doc: Node, analyze: Analyzer) => {
  let documents = analyzers.get(analyze)
  if (!documents) {
    documents = new WeakMap()
    analyzers.set(analyze, documents)
  }
  let cached = documents.get(doc)

  if (!cached) {
    cached = { editorText: editorTextBetween(doc) }
    documents.set(doc, cached)
  }

  return cached
}

export const analyzeEditorDocument = (doc: Node, analyze: Analyzer) => {
  const cached = documentAnalysis(doc, analyze)

  return (cached.analysis ??= analyze(
    cached.editorText
  ) as ProjectedInputAnalysis)
}

export const analyzeEditorProbe = (
  doc: Node,
  source: string,
  analyze: Analyzer
) => {
  const cached = documentAnalysis(doc, analyze)

  if (source === cached.editorText) return analyzeEditorDocument(doc, analyze)
  if (source === cached.probe?.source) return cached.probe

  return (cached.probe = analyze(source) as ProjectedInputAnalysis)
}
