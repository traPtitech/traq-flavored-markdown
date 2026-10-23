export { createRuntime } from './runtime/index.js'
export type {
  Parser,
  ParsedDocument,
  DocumentInput,
  Extractor,
  PlainTextRenderer,
  Processor,
  ProcessedDocument,
  Runtime
} from './runtime/index.js'
export { MarkdownError } from './runtime/errors.js'
export type { MarkdownErrorCode } from './runtime/errors.js'
export type {
  ExtractorOptions,
  PlainTextOptions,
  ProcessorOptions,
  ProcessingResult,
  WhitespacePolicy,
  Extraction,
  References,
  EmbeddedInfo,
  ReferenceEmbeddingPlan,
  ReferenceEmbeddingCandidate,
  ReferenceKind
} from './generated/processing.js'
export type { GrammarPresetId } from './generated/presets.js'
export { isGrammarPresetId, presets } from './generated/presets.js'
export { isKnownNode, schema } from './generated/nodes.js'
export type {
  MutableDocument,
  MutableNode,
  ReadonlyDocument,
  ReadonlyNode,
  NodeVariant
} from './generated/nodes.js'
export {
  embedReferences,
  mentionsUser
} from './traq/messages/reference-embedding.js'
