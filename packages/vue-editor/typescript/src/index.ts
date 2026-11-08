import './style.css'

export { default as ReferenceInput } from './ReferenceInput.vue'
export type {
  InputPart,
  ReferenceCodec,
  ReferenceReplacement,
  ReferenceInputAdapter,
  ReferenceInputHandle,
  MarkdownServices,
  MarkdownLineBreakOptions,
  PreparePaste,
  PastePlan,
  SuggestionContext,
  SuggestionController,
  SuggestionAccessibility
} from './types.js'
export {
  referencePlaceholder,
  partsToProjectedText,
  partsToDisplayText
} from './projection.js'
