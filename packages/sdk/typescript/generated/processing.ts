// Generated from Rust processing contracts. Do not edit.
export type Extraction = {
  attachments: Array<string>
  citations: Array<string>
  embedding: EmbeddingPlan
  messageText: string
  references: References
}
export type EmbeddedInfo = {
  id: string
  raw: string
  type: string
}
export type EmbeddingCandidate = {
  end: number
  kind: LookupKind
  name: string
  raw: string
  /**
   * UTF-8 byte offsets into the original source, not rendered text.
   */
  start: number
}
export type EmbeddingPlan = {
  /**
   * Ordered lookup attempts. A successful attempt consumes its source range.
   */
  candidates: Array<EmbeddingCandidate>
  /**
   * Original Markdown with recognized reference nodes restored to their labels.
   */
  unembeddedText: string
}
export type LookupKind = 'user' | 'group' | 'channel'
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
  origin: string
}
export type RendererOptions = {
  origin: string
}
