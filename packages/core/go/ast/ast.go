// Package ast owns the shared Go syntax tree and decoding machinery.
package ast

import (
	"encoding/json"
	"fmt"
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
	var wire struct {
		Source   string            `json:"source"`
		Children []json.RawMessage `json:"children"`
	}

	if err := json.Unmarshal(raw, &wire); err != nil {
		return nil, err
	}

	children, err := decodeNodes(wire.Children, factory)
	if err != nil {
		return nil, err
	}

	return &Document{Source: wire.Source, Children: children}, nil
}

func decodeNodes(items []json.RawMessage, factory func(string) Payload) ([]Node, error) {
	nodes := make([]Node, len(items))

	for i, raw := range items {
		var value wireNode
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}

		payload := factory(value.Kind)
		if payload == nil {
			return nil, fmt.Errorf("unsupported Rust node: %s", value.Kind)
		}
		if err := json.Unmarshal(value.Data, payload); err != nil {
			return nil, err
		}

		children, err := decodeNodes(value.Children, factory)
		if err != nil {
			return nil, err
		}

		nodes[i] = Node{Kind: value.Kind, Span: value.Span, Data: payload, Children: children}
	}

	return nodes, nil
}
