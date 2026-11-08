package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"
)

// Document owns a validated tree and its wire snapshot. Use ToMutable to edit it.
// The zero value is not a validated document.
type Document struct {
	source   string
	children []Node
	json     string
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
func (n Node) DecodePayload(output Payload) error { return json.Unmarshal(n.PayloadJSON(), output) }

func (d *Document) Source() string   { return d.source }
func (d *Document) Children() []Node { return slices.Clone(d.children) }
func (d *Document) JSON() []byte     { return []byte(d.json) }
func (d *Document) IsValid() bool    { return d != nil && d.json != "" }

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

	children, err := mutableNodes(d.children, d.factory, "$.children")
	if err != nil {
		return nil, err
	}

	return &MutableDocument{Source: d.source, Children: children}, nil
}

// DecodeDocument validates once and owns both the semantic tree and wire bytes.
func DecodeDocument(raw []byte, factory func(string) Payload) (*Document, error) {
	return decodeOwnedDocument(bytes.Clone(raw), factory)
}

// JSONText shares the immutable wire snapshot with repeated transport calls.
func (d *Document) JSONText() string { return d.json }

func mutableNodes(nodes []Node, factory func(string) Payload, path string) ([]MutableNode, error) {
	result := make([]MutableNode, len(nodes))

	for i, node := range nodes {
		at := fmt.Sprintf("%s[%d]", path, i)
		payload := factory(node.kind)
		if payload == nil {
			return nil, invalid(at+".kind", "unsupported node: "+node.kind)
		}

		if err := node.DecodePayload(payload); err != nil {
			return nil, invalid(at+".data", err.Error())
		}

		children, err := mutableNodes(node.children, factory, at+".children")
		if err != nil {
			return nil, err
		}

		result[i] = MutableNode{Kind: node.kind, Span: node.span, Data: payload, Children: children}
		if err := validateStructure(&result[i], at); err != nil {
			return nil, err
		}
	}

	return result, nil
}
