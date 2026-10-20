export { createRuntime } from './runtime/index.js'
export type {
  Parser,
  Extractor,
  PlainTextRenderer,
  Runtime
} from './runtime/index.js'
export { MarkdownError } from './runtime/errors.js'
export type { MarkdownErrorCode } from './runtime/errors.js'
export type {
  ExtractorOptions,
  RendererOptions,
  Extraction,
  References,
  EmbeddedInfo,
  ReferenceEmbeddingPlan,
  ReferenceEmbeddingCandidate,
  LookupKind
} from './generated/processing.js'
export type { Preset } from './generated/presets.js'
export { isPreset, presets } from './generated/presets.js'
export { isKnownNode } from './generated/nodes.js'
export type { Document, Node, NodeKind } from './generated/nodes.js'
export {
  embedReferences,
  mentionsUser
} from './messages/reference-embedding.js'
