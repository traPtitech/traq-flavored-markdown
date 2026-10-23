package ast

import (
	"bytes"
	"encoding/json"
	"slices"
)

// Document owns a validated tree and its wire snapshot. Use ToMutable to edit it.
// The zero value is not a validated document.
type Document struct {
	source   string
	children []Node
	json     []byte
	factory  func(string) Payload
}

// Node is a read-only view into an owned document. Payload decoding produces a
// detached value so callers cannot mutate the document through nested payloads.
type Node struct {
	kind     string
	span     Span
	data     json.RawMessage
	children []Node
}

func (n Node) Kind() string                       { return n.kind }
func (n Node) Span() Span                         { return n.span }
func (n Node) Children() []Node                   { return slices.Clone(n.children) }
func (n Node) PayloadJSON() []byte                { return bytes.Clone(n.data) }
func (n Node) DecodePayload(output Payload) error { return json.Unmarshal(n.data, output) }

func (d *Document) Source() string   { return d.source }
func (d *Document) Children() []Node { return slices.Clone(d.children) }
func (d *Document) JSON() []byte     { return bytes.Clone(d.json) }
func (d *Document) IsValid() bool    { return d != nil && d.json != nil }
func (d *Document) MarshalJSON() ([]byte, error) {
	if !d.IsValid() {
		return nil, invalid("$", "document is required")
	}
	return d.JSON(), nil
}

// ToMutable explicitly creates an independent editing draft using its schema.
func (d *Document) ToMutable() (*MutableDocument, error) {
	if !d.IsValid() {
		return nil, invalid("$", "document is required")
	}
	return decodeMutableDocument(d.json, d.factory)
}

// DecodeDocument validates once and owns both the semantic tree and wire bytes.
func DecodeDocument(raw []byte, factory func(string) Payload) (*Document, error) {
	owned := bytes.Clone(raw)
	draft, err := decodeMutableDocument(owned, factory)
	if err != nil {
		return nil, err
	}
	// Retain the original payload bytes: caller-provided marshalers cannot alter
	// the snapshot after its payloads and structure have passed validation.
	var wire struct {
		Children []wireNode `json:"children"`
	}
	if err := json.Unmarshal(owned, &wire); err != nil {
		return nil, err
	}
	return &Document{source: draft.Source, children: ownNodes(wire.Children), json: owned, factory: factory}, nil
}

type wireNode struct {
	Kind     string          `json:"kind"`
	Span     Span            `json:"span"`
	Data     json.RawMessage `json:"data"`
	Children []wireNode      `json:"children"`
}

func ownNodes(input []wireNode) []Node {
	nodes := make([]Node, len(input))
	for i, node := range input {
		nodes[i] = Node{kind: node.Kind, span: node.Span, data: node.Data, children: ownNodes(node.Children)}
	}
	return nodes
}
