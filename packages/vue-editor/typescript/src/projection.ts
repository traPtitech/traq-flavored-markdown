import type { SourceAnalysis } from '@traq-flavored-markdown/sdk/editor'

import type { InputPart } from './types.js'

export const referencePlaceholder = '\uFFFC'
export type ProjectedInputAnalysis = SourceAnalysis
export const partsToProjectedText = <R>(parts: readonly InputPart<R>[]) =>
  parts
    .map(part => (part.type === 'text' ? part.text : referencePlaceholder))
    .join('')
export const partsToDisplayText = <R>(
  parts: readonly InputPart<R>[],
  label: (reference: R) => string
) =>
  parts
    .map(part => (part.type === 'text' ? part.text : label(part.reference)))
    .join('')
