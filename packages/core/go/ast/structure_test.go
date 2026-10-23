package ast

import (
	"encoding/json"
	"errors"
	"testing"
)

type shapePayload struct {
	Alignments []string `json:"alignments,omitempty"`
	structure  NodeStructure
}

func (*shapePayload) NodePayload()                   {}
func (p *shapePayload) NodeStructure() NodeStructure { return p.structure }
func (p *shapePayload) ChildArity() int              { return len(p.Alignments) }

func shapeFactory(kind string) Payload {
	shape := NodeStructure{Role: "structural", Children: ChildStructure{Kind: "any"}}
	switch kind {
	case "text":
		shape = NodeStructure{Role: "inline", Children: ChildStructure{Kind: "leaf"}}
	case "paragraph":
		shape = NodeStructure{Role: "block", Children: ChildStructure{Kind: "roles", Roles: []string{"inline"}}}
	case "opaque-parent":
		shape = NodeStructure{Role: "block", Children: ChildStructure{Kind: "roles", Roles: []string{"opaque"}}}
	case "list":
		shape.Children = ChildStructure{Kind: "types", Types: []string{"item"}, Nonempty: true}
	case "item":
		shape.Children = ChildStructure{Kind: "roles", Roles: []string{"block"}, Nonempty: true}
	case "table":
		shape.Children = ChildStructure{Kind: "sequence", Prefix: []string{"header"}, Rest: "row", HasArity: true}
	case "sequence":
		shape.Children = ChildStructure{Kind: "sequence", Prefix: []string{"first", "second"}, Rest: "rest"}
	case "header", "row":
		shape.Children = ChildStructure{Kind: "types", Types: []string{"cell"}, Nonempty: true}
	case "opaque":
		return &testPayload{}
	}
	return &shapePayload{structure: shape}
}

func shapeNode(kind string, children ...Node) Node {
	return Node{Kind: kind, Data: shapeFactory(kind), Children: children}
}

func TestGeneratedChildPoliciesAtDecodeBoundary(t *testing.T) {
	text := shapeNode("text")
	paragraph := shapeNode("paragraph", text)
	for _, node := range []Node{
		text,
		paragraph,
		shapeNode("list", shapeNode("item", paragraph)),
		shapeNode("any", shapeNode("opaque")),
		shapeNode("opaque-parent", shapeNode("opaque")),
	} {
		raw, err := json.Marshal(Document{Children: []Node{node}})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := DecodeDocument(raw, shapeFactory); err != nil {
			t.Fatalf("valid %s: %v", node.Kind, err)
		}
	}
	cases := map[string]Node{
		"leaf children":                shapeNode("text", text),
		"wrong role":                   shapeNode("paragraph", paragraph),
		"unknown role":                 shapeNode("paragraph", shapeNode("opaque")),
		"opaque parent rejects inline": shapeNode("opaque-parent", text),
		"empty typed children":         shapeNode("list"),
		"wrong child type":             shapeNode("list", paragraph),
		"empty role children":          shapeNode("item"),
	}
	for name, node := range cases {
		t.Run(name, func(t *testing.T) {
			raw, err := json.Marshal(Document{Children: []Node{node}})
			if err != nil {
				t.Fatal(err)
			}
			_, err = DecodeDocument(raw, shapeFactory)
			var detail *ValidationError
			if !errors.As(err, &detail) || detail.Path != "$.children[0].children" || detail.Span == nil {
				t.Fatalf("expected structural path/span, got %v", err)
			}
		})
	}
}

func TestGeneratedSequencePolicyValidatesPrefixAndArity(t *testing.T) {
	cell := shapeNode("cell")
	header := shapeNode("header", cell, cell)
	row := shapeNode("row", cell, cell)
	cases := []struct {
		name     string
		columns  []string
		children []Node
		valid    bool
	}{
		{"header only", []string{"left", "none"}, []Node{header}, true},
		{"header and row", []string{"left", "none"}, []Node{header, row}, true},
		{"zero columns", nil, []Node{header}, false},
		{"missing header", []string{"left", "none"}, []Node{row}, false},
		{"header after header", []string{"left", "none"}, []Node{header, header}, false},
		{"narrow header", []string{"left", "none"}, []Node{shapeNode("header", cell)}, false},
		{"narrow body", []string{"left", "none"}, []Node{header, shapeNode("row", cell)}, false},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			table := shapeNode("table", test.children...)
			table.Data.(*shapePayload).Alignments = test.columns
			raw, err := json.Marshal(Document{Children: []Node{table}})
			if err != nil {
				t.Fatal(err)
			}
			_, err = DecodeDocument(raw, shapeFactory)
			if (err == nil) != test.valid {
				t.Fatalf("valid=%t: %v", test.valid, err)
			}
		})
	}
}

func TestSequenceWithoutArity(t *testing.T) {
	for _, test := range []struct {
		kinds []string
		valid bool
	}{
		{[]string{"first", "second"}, true},
		{[]string{"first", "second", "rest", "rest"}, true},
		{[]string{"first"}, false},
		{[]string{"second", "first"}, false},
		{[]string{"first", "second", "first"}, false},
	} {
		var children []Node
		for _, kind := range test.kinds {
			children = append(children, shapeNode(kind))
		}
		parent := shapeNode("sequence", children...)
		if err := validateStructure(&parent, "$"); (err == nil) != test.valid {
			t.Fatalf("%v: valid=%v: %v", test.kinds, test.valid, err)
		}
	}
}
