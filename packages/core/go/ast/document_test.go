package ast

import (
	"encoding/json"
	"testing"
)

type nestedPayload struct {
	Values []string `json:"values"`
}

func (*nestedPayload) NodePayload() {}

func TestDocumentOwnsTreePayloadsAndEditingDrafts(t *testing.T) {
	factory := func(string) Payload { return &nestedPayload{} }
	input := &MutableDocument{Source: "x", Children: []MutableNode{{Kind: "custom", Span: Span{End: 1}, Data: &nestedPayload{Values: []string{"original"}}}}}
	document, err := NewDocument(input, factory)
	if err != nil {
		t.Fatal(err)
	}
	input.Children[0].Data.(*nestedPayload).Values[0] = "changed"
	view := document.Children()
	var payload nestedPayload
	if err := view[0].DecodePayload(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Values[0] != "original" {
		t.Fatal("snapshot aliases caller payload")
	}
	payload.Values[0] = "changed again"
	view[0] = Node{}
	bytes := document.JSON()
	bytes[0] = '!'
	draft, err := document.ToMutable()
	if err != nil {
		t.Fatal(err)
	}
	draft.Children[0].Data.(*nestedPayload).Values[0] = "edited"
	if err := document.Children()[0].DecodePayload(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Values[0] != "original" || document.Source() != "x" {
		t.Fatal("snapshot changed")
	}
	edited, err := NewDocument(draft, factory)
	if err != nil {
		t.Fatal(err)
	}
	if err := edited.Children()[0].DecodePayload(&payload); err != nil || payload.Values[0] != "edited" {
		t.Fatalf("edit: %+v %v", payload, err)
	}
	if (&Document{}).IsValid() {
		t.Fatal("zero document must not carry validation proof")
	}
	if _, err := json.Marshal(&Document{}); err == nil {
		t.Fatal("encoded invalid zero document")
	}
}
