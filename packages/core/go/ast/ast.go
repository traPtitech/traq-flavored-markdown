// Package ast owns mutable drafts and immutable, validated document snapshots.
package ast

// Limits describes the default tree boundary shared with native consumers.
type Limits struct {
	SourceBytes  int
	PayloadBytes int
	Nodes        int
	Depth        int
}

func DefaultLimits() Limits {
	return Limits{SourceBytes: maxSourceBytes, PayloadBytes: maxJSONBytes, Nodes: maxDocumentNodes, Depth: maxDocumentDepth}
}

type Span struct {
	Start uint32 `json:"start"`
	End   uint32 `json:"end"`
}
type Payload interface{ NodePayload() }
type MutableNode struct {
	Kind     string        `json:"kind"`
	Span     Span          `json:"span"`
	Data     Payload       `json:"data"`
	Children []MutableNode `json:"children,omitempty"`
}
type MutableDocument struct {
	Source   string        `json:"source"`
	Children []MutableNode `json:"children"`
}
