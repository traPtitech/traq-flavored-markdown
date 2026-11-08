package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
)

// decodeOwnedDocument validates payloads while constructing their immutable wire views.
func decodeOwnedDocument(raw []byte, factory func(string) Payload) (*Document, error) {
	if len(raw) > maxJSONBytes {
		return nil, limit("$", "json_bytes")
	}

	if err := contract.ValidateJSON(raw); err != nil {
		return nil, invalid("$", err.Error())
	}

	var wire struct {
		Source   *string         `json:"source"`
		Children json.RawMessage `json:"children"`
	}
	if err := strict(raw, &wire); err != nil {
		return nil, invalid("$", err.Error())
	}

	if wire.Source == nil || len(wire.Children) == 0 || bytes.Equal(wire.Children, []byte("null")) {
		return nil, invalid("$", "source and children are required")
	}

	if err := ValidateSource(*wire.Source); err != nil {
		return nil, err
	}

	state := decoder{source: *wire.Source, factory: factory}
	children, err := state.decodeNodes(wire.Children, Span{End: uint32(len(*wire.Source))}, 1, "$.children")
	if err != nil {
		return nil, err
	}

	return &Document{source: *wire.Source, children: children.nodes, json: string(raw), factory: factory}, nil
}

type decodedNodes struct {
	nodes  []Node
	shapes []nodeShape
}

type decoder struct {
	source       string
	factory      func(string) Payload
	nodes        int
	payloadBytes int
}

func (s *decoder) count(n, depth int, path string) error {
	if depth > maxDocumentDepth && n > 0 {
		return limit(path, "depth")
	}

	if n > maxDocumentNodes-s.nodes {
		return limit(path, "nodes")
	}

	s.nodes += n
	return nil
}

func (s *decoder) span(span, parent Span, end uint32, path string) error {
	if span.Start > span.End || span.Start < parent.Start || span.End > parent.End || span.Start < end || !IsBoundary(s.source, span.Start) || !IsBoundary(s.source, span.End) {
		return &ValidationError{Path: path + ".span", Message: "span is outside its parent, overlaps a sibling, or splits UTF-8", Span: &span}
	}

	return nil
}

func (s *decoder) decodeNodes(raw json.RawMessage, parent Span, depth int, path string) (decodedNodes, error) {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return decodedNodes{}, invalid(path, err.Error())
	}

	if err := s.count(len(items), depth, path); err != nil {
		return decodedNodes{}, err
	}

	nodes := decodedNodes{nodes: make([]Node, len(items)), shapes: make([]nodeShape, len(items))}
	end := parent.Start

	for i, raw := range items {
		at := fmt.Sprintf("%s[%d]", path, i)

		var wire struct {
			Kind *string `json:"kind"`
			Span *struct {
				Start *uint32 `json:"start"`
				End   *uint32 `json:"end"`
			} `json:"span"`
			Data     json.RawMessage `json:"data"`
			Children json.RawMessage `json:"children"`
		}
		if err := strict(raw, &wire); err != nil {
			return decodedNodes{}, invalid(at, err.Error())
		}

		if wire.Kind == nil || wire.Span == nil || wire.Span.Start == nil || wire.Span.End == nil || len(wire.Data) == 0 || bytes.Equal(wire.Data, []byte("null")) {
			return decodedNodes{}, invalid(at, "kind, span.start, span.end and data are required")
		}

		span := Span{Start: *wire.Span.Start, End: *wire.Span.End}
		if err := s.span(span, parent, end, at); err != nil {
			return decodedNodes{}, err
		}

		end = span.End

		if s.factory == nil {
			return decodedNodes{}, invalid(at+".kind", "node factory is required")
		}

		payload := s.factory(*wire.Kind)
		if payload == nil {
			return decodedNodes{}, invalid(at+".kind", "unsupported node: "+*wire.Kind)
		}

		if err := json.Unmarshal(bytes.Clone(wire.Data), payload); err != nil {
			return decodedNodes{}, invalid(at+".data", err.Error())
		}

		children := decodedNodes{}

		if len(wire.Children) > 0 {
			if bytes.Equal(wire.Children, []byte("null")) {
				return decodedNodes{}, invalid(at+".children", "children must be an array")
			}

			var err error
			children, err = s.decodeNodes(wire.Children, span, depth+1, at+".children")
			if err != nil {
				return decodedNodes{}, err
			}
		}

		if err := validateChildStructure(payload, span, children.shapes, at); err != nil {
			return decodedNodes{}, err
		}

		nodes.nodes[i] = Node{kind: *wire.Kind, span: span, data: wire.Data, children: children.nodes}
		nodes.shapes[i] = shapeOf(*wire.Kind, payload, len(children.nodes))
	}

	return nodes, nil
}
