import {
  boolean,
  fields,
  nullable,
  oneOf,
  string
} from '@traq-flavored-markdown/core/validation'

// Generated from Rust processing contracts. Do not edit.
export type Extraction = {
  attachments: Array<string>
  citations: Array<string>
  messageText: string
  referenceEmbedding: ReferenceEmbeddingPlan
  references: References
}
export type EmbeddedInfo = {
  id: string
  raw: string
  type: EmbeddedKind
}
export type EmbeddedKind = 'user' | 'group' | 'channel' | 'file' | 'message'
export type ReferenceEmbeddingCandidate = {
  end: number
  kind: ReferenceKind
  name: string
  raw: string
  /**
   * UTF-8 byte offsets into the original source, not rendered text.
   */
  start: number
}
export type ReferenceEmbeddingPlan = {
  /**
   * Ordered lookup attempts. A successful attempt consumes its source range.
   */
  candidates: Array<ReferenceEmbeddingCandidate>
  /**
   * Original Markdown with recognized reference nodes restored to their labels.
   */
  unembeddedText: string
}
export type ReferenceKind = 'user' | 'group' | 'channel'
export type References = {
  channelLinks: Array<string>
  embeddings: Array<EmbeddedInfo>
  groupMentions: Array<string>
  mentions: Array<string>
}
export type ExtractorOptions = {
  /**
   * Origin used to recognize traQ file/message URLs; empty leaves URLs as text.
   */
  origin?: string
}
export type PlainTextOptions = {
  origin?: string
  whitespace?: WhitespacePolicy
}
export type WhitespacePolicy = 'preserve' | 'collapse'
export type ProcessingResult = {
  extraction: Extraction
  plainText: string
}
export type ProcessorConfiguration = {
  options?: ProcessorOptions
  preset: string
}
export type ProcessorOptions = {
  origin?: string
  whitespace?: WhitespacePolicy
}

function validateExtraction(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        attachments: (value: unknown) =>
          Array.isArray(value) && value.every(string),
        citations: (value: unknown) =>
          Array.isArray(value) && value.every(string),
        messageText: string,
        referenceEmbedding: validateReferenceEmbeddingPlan,
        references: validateReferences
      },
      {}
    ))(value)
}
function validateEmbeddedInfo(value: unknown): boolean {
  return ((value: unknown) =>
    fields(value, { id: string, raw: string, type: validateEmbeddedKind }, {}))(
    value
  )
}
function validateEmbeddedKind(value: unknown): boolean {
  return oneOf('user', 'group', 'channel', 'file', 'message')(value)
}
function validateReferenceEmbeddingCandidate(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        end: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 4294967295,
        kind: validateReferenceKind,
        name: string,
        raw: string,
        start: (value: unknown) =>
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 4294967295
      },
      {}
    ))(value)
}
function validateReferenceEmbeddingPlan(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        candidates: (value: unknown) =>
          Array.isArray(value) &&
          value.every(validateReferenceEmbeddingCandidate),
        unembeddedText: string
      },
      {}
    ))(value)
}
function validateReferenceKind(value: unknown): boolean {
  return oneOf('user', 'group', 'channel')(value)
}
function validateReferences(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {
        channelLinks: (value: unknown) =>
          Array.isArray(value) && value.every(string),
        embeddings: (value: unknown) =>
          Array.isArray(value) && value.every(validateEmbeddedInfo),
        groupMentions: (value: unknown) =>
          Array.isArray(value) && value.every(string),
        mentions: (value: unknown) =>
          Array.isArray(value) && value.every(string)
      },
      {}
    ))(value)
}
function validateExtractorOptions(value: unknown): boolean {
  return ((value: unknown) => fields(value, {}, { origin: string }))(value)
}
function validatePlainTextOptions(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {},
      { origin: string, whitespace: validateWhitespacePolicy }
    ))(value)
}
function validateWhitespacePolicy(value: unknown): boolean {
  return oneOf('preserve', 'collapse')(value)
}
function validateProcessingResult(value: unknown): boolean {
  return ((value: unknown) =>
    fields(value, { extraction: validateExtraction, plainText: string }, {}))(
    value
  )
}
function validateProcessorConfiguration(value: unknown): boolean {
  return ((value: unknown) =>
    fields(value, { preset: string }, { options: validateProcessorOptions }))(
    value
  )
}
function validateProcessorOptions(value: unknown): boolean {
  return ((value: unknown) =>
    fields(
      value,
      {},
      { origin: string, whitespace: validateWhitespacePolicy }
    ))(value)
}
export const isExtraction = (value: unknown): value is Extraction =>
  validateExtraction(value)
export const isExtractorOptions = (value: unknown): value is ExtractorOptions =>
  validateExtractorOptions(value)
export const isPlainTextOptions = (value: unknown): value is PlainTextOptions =>
  validatePlainTextOptions(value)
export const isProcessingResult = (value: unknown): value is ProcessingResult =>
  validateProcessingResult(value)
export const isProcessorConfiguration = (
  value: unknown
): value is ProcessorConfiguration => validateProcessorConfiguration(value)
export const isProcessorOptions = (value: unknown): value is ProcessorOptions =>
  validateProcessorOptions(value)
