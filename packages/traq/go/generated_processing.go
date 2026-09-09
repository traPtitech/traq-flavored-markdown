// Code generated from Rust processing contracts. DO NOT EDIT.
package markdown

type Extraction struct {
	Attachments []string      `json:"attachments"`
	Citations   []string      `json:"citations"`
	Embedding   EmbeddingPlan `json:"embedding"`
	MessageText string        `json:"messageText"`
	References  References    `json:"references"`
}
type EmbeddedInfo struct {
	ID   string `json:"id"`
	Raw  string `json:"raw"`
	Type string `json:"type"`
}
type EmbeddingCandidate struct {
	End   uint32 `json:"end"`
	Kind  string `json:"kind"`
	Name  string `json:"name"`
	Raw   string `json:"raw"`
	Start uint32 `json:"start"`
}
type EmbeddingPlan struct {
	Candidates     []EmbeddingCandidate `json:"candidates"`
	UnembeddedText string               `json:"unembeddedText"`
}
type LookupKind = string
type References struct {
	ChannelLinks  []string       `json:"channelLinks"`
	Embeddings    []EmbeddedInfo `json:"embeddings"`
	GroupMentions []string       `json:"groupMentions"`
	Mentions      []string       `json:"mentions"`
}
type ExtractorOptions struct {
	Origin string `json:"origin"`
}
type RendererOptions struct {
	Origin string `json:"origin"`
}
