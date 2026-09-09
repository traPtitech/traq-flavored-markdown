// Generated from Rust processing contracts. Do not edit.
export type Extraction = { messageText: string, attachments: Array<string>, citations: Array<string>, references: References, embedding: EmbeddingPlan, };
export type EmbeddingPlan = {
/**
 * Ordered lookup attempts. A successful attempt consumes its source range.
 */
candidates: Array<EmbeddingCandidate>,
/**
 * Original Markdown with recognized reference nodes restored to their labels.
 */
unembeddedText: string, };
export type EmbeddingCandidate = {
/**
 * UTF-8 byte offsets into the original source, not rendered text.
 */
start: number, end: number, raw: string, name: string, kind: LookupKind, };
export type LookupKind = "user" | "group" | "channel";
export type References = { mentions: Array<string>, groupMentions: Array<string>, channelLinks: Array<string>, embeddings: Array<EmbeddedInfo>, };
export type EmbeddedInfo = { raw: string, type: string, id: string, };
export type ExtractorOptions = {
/**
 * Origin used to recognize traQ file/message URLs; empty leaves URLs as text.
 */
origin: string, };
export type RendererOptions = { origin: string, };
