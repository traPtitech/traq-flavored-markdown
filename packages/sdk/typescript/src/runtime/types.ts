import type {
  DocumentContext,
  ReadonlyDocument
} from '@traq-flavored-markdown/core'

import type { NodeVariant } from '../generated/nodes.js'
import type { GrammarPresetId } from '../generated/presets.js'
import type {
  Extraction,
  ExtractorOptions,
  PlainTextOptions,
  ProcessingResult,
  ProcessorOptions
} from '../generated/processing.js'

/** An immutable, validated result that all document consumers can reuse. */
export type ParsedDocument = DocumentContext<NodeVariant>
export type DocumentInput = ReadonlyDocument | DocumentContext

export interface Parser {
  parse(source: string): ParsedDocument
  parseInline(source: string): ParsedDocument
  dispose(): void
}
export interface Extractor {
  extract(document: DocumentInput): Extraction
  dispose(): void
}
export interface PlainTextRenderer {
  render(document: DocumentInput): string
  dispose(): void
}
export interface ProcessedDocument extends ProcessingResult {
  document: ParsedDocument
}
export interface Processor {
  process(source: string): ProcessedDocument
  processInline(source: string): ProcessedDocument
  dispose(): void
}
export interface Runtime {
  createParser(preset: GrammarPresetId): Parser
  createExtractor(options?: ExtractorOptions): Extractor
  createPlainTextRenderer(options?: PlainTextOptions): PlainTextRenderer
  createProcessor(
    preset: GrammarPresetId,
    options?: ProcessorOptions
  ): Processor
  dispose(): void
}
