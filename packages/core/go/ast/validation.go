package ast

import (
	"encoding/json"
	"fmt"
	"reflect"
)

// NewDocument snapshots a mutable tree before any consumer can observe it.
// The bounded structural walk runs before JSON encoding, including for cycles.
func NewDocument(document *MutableDocument, factory func(string) Payload) (*Document, error) {
	if document == nil {
		return nil, invalid("$", "document is required")
	}
	if err := ValidateSource(document.Source); err != nil {
		return nil, err
	}
	state := decoder{source: document.Source, factory: factory}
	seen := make(map[*MutableNode]bool)
	var walk func([]MutableNode, Span, int, string) error
	walk = func(nodes []MutableNode, parent Span, depth int, path string) error {
		if err := state.count(len(nodes), depth, path); err != nil {
			return err
		}
		end := parent.Start
		for i := range nodes {
			node := &nodes[i]
			at := fmt.Sprintf("%s[%d]", path, i)
			if seen[node] {
				return invalid(at, "document must be a tree")
			}
			seen[node] = true
			if err := state.span(node.Span, parent, end, at); err != nil {
				return err
			}
			end = node.Span.End
			if node.Data == nil || nilValue(reflect.ValueOf(node.Data)) {
				return invalid(at+".data", "data is required")
			}
			if err := validStrings(reflect.ValueOf(node.Data), make(map[uintptr]bool), 0, &state.payloadBytes); err != nil {
				if typed, ok := err.(*ValidationError); ok {
					typed.Path = at + ".data"
					return typed
				}
				return invalid(at+".data", err.Error())
			}
			if err := walk(node.Children, node.Span, depth+1, at+".children"); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(document.Children, Span{End: uint32(len(document.Source))}, 1, "$.children"); err != nil {
		return nil, err
	}
	// Payload marshalers are untrusted too: validate their resulting wire shape.
	owned := *document
	if owned.Children == nil {
		owned.Children = []MutableNode{}
	}
	raw, err := json.Marshal(&owned)
	if err != nil {
		return nil, invalid("$", err.Error())
	}
	return DecodeDocument(raw, factory)
}
