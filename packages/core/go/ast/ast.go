// Package ast owns the shared Go syntax tree and decoding machinery.
package ast

import (
	"encoding/json"
	"fmt"
	"unicode/utf8"
)

const (
	maxJSONBytes     = 8 * 1024 * 1024
	maxSourceBytes   = 65_536
	maxDocumentNodes = 16_384
	maxDocumentDepth = 64
)

type Span struct {
	Start uint32 `json:"start"`
	End   uint32 `json:"end"`
}

type Payload interface{ NodePayload() }

type Node struct {
	Kind     string  `json:"kind"`
	Span     Span    `json:"span"`
	Data     Payload `json:"data"`
	Children []Node  `json:"children,omitempty"`
}

type Document struct {
	Source   string `json:"source"`
	Children []Node `json:"children"`
}

type wireNode struct {
	Kind     string            `json:"kind"`
	Span     Span              `json:"span"`
	Data     json.RawMessage   `json:"data"`
	Children []json.RawMessage `json:"children"`
}

// DecodeDocument uses the distribution's node factories without global registration.
// Unknown kinds are errors; decoding never silently drops a Rust node.
func DecodeDocument(raw []byte, factory func(string) Payload) (*Document, error) {
	if len(raw) > maxJSONBytes {
		return nil, fmt.Errorf("JSON byte limit exceeded")
	}

	var wire struct {
		Source   string            `json:"source"`
		Children []json.RawMessage `json:"children"`
	}

	if err := json.Unmarshal(raw, &wire); err != nil {
		return nil, err
	}
	if len(wire.Source) > maxSourceBytes {
		return nil, fmt.Errorf("source byte limit exceeded")
	}

	state := decoder{source: wire.Source, factory: factory}
	children, err := state.decodeNodes(wire.Children, Span{End: uint32(len(wire.Source))}, 1)
	if err != nil {
		return nil, err
	}

	return &Document{Source: wire.Source, Children: children}, nil
}

type decoder struct {
	source  string
	factory func(string) Payload
	nodes   int
}

func (state *decoder) decodeNodes(items []json.RawMessage, parent Span, depth int) ([]Node, error) {
	if depth > maxDocumentDepth && len(items) > 0 {
		return nil, fmt.Errorf("node depth limit exceeded")
	}
	if len(items) > maxDocumentNodes-state.nodes {
		return nil, fmt.Errorf("node count limit exceeded")
	}
	state.nodes += len(items)
	nodes := make([]Node, len(items))

	for i, raw := range items {
		var value wireNode
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		if value.Span.Start > value.Span.End || value.Span.Start < parent.Start || value.Span.End > parent.End ||
			!state.boundary(value.Span.Start) || !state.boundary(value.Span.End) {
			return nil, fmt.Errorf("invalid node span: %d..%d", value.Span.Start, value.Span.End)
		}

		payload := state.factory(value.Kind)
		if payload == nil {
			return nil, fmt.Errorf("unsupported Rust node: %s", value.Kind)
		}
		if err := json.Unmarshal(value.Data, payload); err != nil {
			return nil, err
		}

		children, err := state.decodeNodes(value.Children, value.Span, depth+1)
		if err != nil {
			return nil, err
		}

		nodes[i] = Node{Kind: value.Kind, Span: value.Span, Data: payload, Children: children}
	}

	return nodes, nil
}

func (state *decoder) boundary(position uint32) bool {
	return position == uint32(len(state.source)) || utf8.RuneStart(state.source[position])
}
