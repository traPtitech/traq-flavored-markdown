package ast

import (
	"bytes"
	"encoding/json"
	"testing"
)

type mutatingPayload struct{}

func (*mutatingPayload) NodePayload() {}

func (*mutatingPayload) UnmarshalJSON(raw []byte) error {
	raw[0] = '!'
	return nil
}

func (*mutatingPayload) MarshalJSON() ([]byte, error) { return []byte(`{"changed":true}`), nil }

func TestPayloadCodecsCannotRewriteOwnedWireData(t *testing.T) {
	raw := []byte(`{"source":"","children":[{"kind":"custom","span":{"start":0,"end":0},"data":{}}]}`)
	original := bytes.Clone(raw)
	document, err := DecodeDocument(raw, func(string) Payload { return &mutatingPayload{} })
	if err != nil {
		t.Fatal(err)
	}

	raw[0] = '!'

	if _, err := document.ToMutable(); err != nil {
		t.Fatal(err)
	}

	if err := document.Children()[0].DecodePayload(&mutatingPayload{}); err != nil {
		t.Fatal(err)
	}

	if document.JSONText() != string(original) || string(document.Children()[0].PayloadJSON()) != "{}" {
		t.Fatal("payload codec changed the owned wire snapshot")
	}
}

func FuzzDocumentRoundtrip(f *testing.F) {
	for _, raw := range []string{
		`{"source":"","children":[]}`,
		`{"source":"日😀","children":[{"kind":"custom","span":{"start":0,"end":7},"data":{"values":["日😀"]}}]}`,
		`{"source":"x","children":[{"kind":"custom","span":{"start":0,"end":9},"data":{}}]}`,
	} {
		f.Add([]byte(raw))
	}

	f.Fuzz(func(t *testing.T, raw []byte) {
		if len(raw) > 4096 {
			return
		}

		factory := func(string) Payload { return &nestedPayload{} }
		document, err := DecodeDocument(raw, factory)
		if err != nil {
			return
		}

		if document.JSONText() != string(raw) {
			t.Fatal("wire spelling changed")
		}

		copy, err := DecodeDocument(document.JSON(), factory)
		if err != nil || copy.JSONText() != document.JSONText() {
			t.Fatalf("roundtrip: %v", err)
		}

		draft, err := document.ToMutable()
		if err != nil {
			t.Fatal(err)
		}

		draft.Source = "changed"
		if document.Source() != copy.Source() {
			t.Fatal("draft changed snapshot")
		}
	})
}

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
