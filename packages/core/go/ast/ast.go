// Package ast owns the shared Go syntax tree and validated document boundary.
package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
	"reflect"
	"strings"
	"unicode/utf8"
)

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

// ValidatedDocument owns a detached, immutable JSON snapshot. JSON returns a copy.
type ValidatedDocument struct{ json []byte }

func (d *ValidatedDocument) JSON() []byte { return bytes.Clone(d.json) }

// DecodeValidatedDocument keeps a successfully decoded wire tree as an owned
// snapshot for subsequent consumers, without re-encoding mutable public nodes.
func DecodeValidatedDocument(raw []byte, factory func(string) Payload) (*ValidatedDocument, error) {
	if _, err := DecodeDocument(raw, factory); err != nil {
		return nil, err
	}
	return &ValidatedDocument{json: bytes.Clone(raw)}, nil
}

// ValidationError identifies an invalid document without requiring message parsing.
type ValidationError struct {
	Path     string
	Resource string
	Message  string
	Span     *Span
}

func (e *ValidationError) Error() string { return e.Path + ": " + e.Message }
func invalid(path, message string) error { return &ValidationError{Path: path, Message: message} }
func limit(path, resource string) error {
	return &ValidationError{Path: path, Resource: resource, Message: resource + " limit exceeded"}
}

// DecodeDocument validates the wire tree before exposing it to callers.
func DecodeDocument(raw []byte, factory func(string) Payload) (*Document, error) {
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
	return &Document{Source: *wire.Source, Children: children}, nil
}

// ValidateDocument snapshots a mutable tree before any consumer can observe it.
// The bounded structural walk runs before JSON encoding, including for cycles.
func ValidateDocument(document *Document, factory func(string) Payload) (*ValidatedDocument, error) {
	if document == nil {
		return nil, invalid("$", "document is required")
	}
	if err := ValidateSource(document.Source); err != nil {
		return nil, err
	}
	state := decoder{source: document.Source, factory: factory}
	seen := make(map[*Node]bool)
	var walk func([]Node, Span, int, string) error
	walk = func(nodes []Node, parent Span, depth int, path string) error {
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
		owned.Children = []Node{}
	}
	raw, err := json.Marshal(&owned)
	if err != nil {
		return nil, invalid("$", err.Error())
	}
	if _, err := DecodeDocument(raw, factory); err != nil {
		return nil, err
	}
	return &ValidatedDocument{json: raw}, nil
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
func (s *decoder) decodeNodes(raw json.RawMessage, parent Span, depth int, path string) ([]Node, error) {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, invalid(path, err.Error())
	}
	if err := s.count(len(items), depth, path); err != nil {
		return nil, err
	}
	nodes := make([]Node, len(items))
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
			return nil, invalid(at, err.Error())
		}
		if wire.Kind == nil || wire.Span == nil || wire.Span.Start == nil || wire.Span.End == nil || len(wire.Data) == 0 || bytes.Equal(wire.Data, []byte("null")) {
			return nil, invalid(at, "kind, span.start, span.end and data are required")
		}
		span := Span{Start: *wire.Span.Start, End: *wire.Span.End}
		if err := s.span(span, parent, end, at); err != nil {
			return nil, err
		}
		end = span.End
		if s.factory == nil {
			return nil, invalid(at+".kind", "node factory is required")
		}
		payload := s.factory(*wire.Kind)
		if payload == nil {
			return nil, invalid(at+".kind", "unsupported node: "+*wire.Kind)
		}
		if err := json.Unmarshal(wire.Data, payload); err != nil {
			return nil, invalid(at+".data", err.Error())
		}
		children := []Node(nil)
		if len(wire.Children) > 0 {
			if bytes.Equal(wire.Children, []byte("null")) {
				return nil, invalid(at+".children", "children must be an array")
			}
			var err error
			children, err = s.decodeNodes(wire.Children, span, depth+1, at+".children")
			if err != nil {
				return nil, err
			}
		}
		node := Node{Kind: *wire.Kind, Span: span, Data: payload, Children: children}
		if err := validateStructure(&node, at); err != nil {
			return nil, err
		}
		nodes[i] = node
	}
	return nodes, nil
}
func strict(raw []byte, output any) error {
	if err := exactFields(raw, reflect.TypeOf(output).Elem()); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(output)
}

// Go's default struct decoder matches keys case-insensitively; wire fields are
// exact names, including the nested span object.
func exactFields(raw []byte, shape reflect.Type) error {
	for shape.Kind() == reflect.Pointer {
		shape = shape.Elem()
	}
	if shape.Kind() != reflect.Struct {
		return nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	allowed := make(map[string]reflect.Type, shape.NumField())
	for i := 0; i < shape.NumField(); i++ {
		field := shape.Field(i)
		name := strings.Split(field.Tag.Get("json"), ",")[0]
		if name != "-" {
			allowed[name] = field.Type
		}
	}
	for name, value := range fields {
		field, ok := allowed[name]
		if !ok {
			return fmt.Errorf("unknown field: %s", name)
		}
		if err := exactFields(value, field); err != nil {
			return err
		}
	}
	return nil
}
func nilValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice:
		return v.IsNil()
	}
	return false
}
func validStrings(v reflect.Value, seen map[uintptr]bool, depth int, payloadBytes *int) error {
	if !v.IsValid() {
		return nil
	}
	if depth > 128 {
		return limit("", "payload_depth")
	}
	if *payloadBytes >= maxJSONBytes {
		return limit("", "payload_bytes")
	}
	*payloadBytes++
	switch v.Kind() {
	case reflect.String:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		*payloadBytes += v.Len()
		if !utf8.ValidString(v.String()) {
			return fmt.Errorf("invalid UTF-8 string")
		}
	case reflect.Interface:
		if !v.IsNil() {
			return validStrings(v.Elem(), seen, depth+1, payloadBytes)
		}
	case reflect.Pointer:
		if !v.IsNil() {
			id := v.Pointer()
			if seen[id] {
				return fmt.Errorf("cyclic payload")
			}
			seen[id] = true
			defer delete(seen, id)
			return validStrings(v.Elem(), seen, depth+1, payloadBytes)
		}
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			if err := validStrings(v.Field(i), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	case reflect.Slice, reflect.Array:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		for i := 0; i < v.Len(); i++ {
			if err := validStrings(v.Index(i), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	case reflect.Map:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		iterator := v.MapRange()
		for iterator.Next() {
			if err := validStrings(iterator.Key(), seen, depth+1, payloadBytes); err != nil {
				return err
			}
			if err := validStrings(iterator.Value(), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	}
	return nil
}
