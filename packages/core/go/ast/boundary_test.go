package ast

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func TestSharedSourceFixtures(t *testing.T) {
	raw, err := os.ReadFile("../../../../tests/fixtures/source-spans.json")
	if err != nil {
		t.Fatal(err)
	}
	type rangeText struct {
		Start uint32
		End   uint32
		Text  string
	}
	var fixtures []struct {
		Name         string
		Source       string
		Slices       []rangeText
		InvalidSpans []Span
		Edits        []rangeText
		Expected     string
	}
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			source, err := NewSourceText(fixture.Source)
			if err != nil {
				t.Fatal(err)
			}
			for _, slice := range fixture.Slices {
				actual, err := source.Slice(Span{Start: slice.Start, End: slice.End})
				if err != nil || actual != slice.Text {
					t.Fatalf("slice %+v: %q %v", slice, actual, err)
				}
			}
			for _, span := range fixture.InvalidSpans {
				if _, err := source.Slice(span); err == nil {
					t.Fatalf("accepted invalid span %+v", span)
				}
			}
			edits := make([]SourceEdit, len(fixture.Edits))
			for i, edit := range fixture.Edits {
				edits[i] = SourceEdit{Span: Span{Start: edit.Start, End: edit.End}, Text: edit.Text}
			}
			actual, err := source.Replace(edits)
			if err != nil || actual != fixture.Expected {
				t.Fatalf("replacement %q, want %q: %v", actual, fixture.Expected, err)
			}
		})
	}
}

func TestDecodeRejectsLossyOrIncompleteDocuments(t *testing.T) {
	for _, raw := range []string{
		`{}`, `{"source":""}`, `{"children":[]}`, `{"source":"","children":null}`,
		`{"source":"x","source":"y","children":[]}`,
		`{"Source":"x","children":[]}`,
		`{"source":"x","children":[{"Kind":"text","span":{"start":0,"end":1},"data":{}}]}`,
		`{"source":"x","children":[{"kind":"text","span":{"Start":0,"end":1},"data":{}}]}`,
		`{"source":"\ud800","children":[]}`, `{"source":"\udfff","children":[]}`,
		`{"source":"x","children":[{"kind":"text","data":{}}]}`,
		`{"source":"x","children":[{"kind":"text","span":{"end":1},"data":{}}]}`,
		`{"source":"x","children":[{"kind":"text","span":{"start":0,"end":1}}]}`,
		`{"source":"x","children":[{"kind":"text","span":{"start":0,"end":1},"data":{},"children":null}]}`,
		`{"source":"x","children":[{"kind":"text","span":{"start":0,"end":1},"data":{}},{"kind":"text","span":{"start":0,"end":1},"data":{}}]}`,
		"{\"source\":\"\xff\",\"children\":[]}",
	} {
		if _, err := DecodeDocument([]byte(raw), testFactory); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func TestSourceTextChecksByteEdits(t *testing.T) {
	source, err := NewSourceText("\ufeffé\r\n\x00😀")
	if err != nil {
		t.Fatal(err)
	}
	if result, err := source.Replace(nil); err != nil || result != source.String() {
		t.Fatalf("%q %v", result, err)
	}
	if _, err := source.Slice(Span{Start: 4, End: 5}); err == nil {
		t.Fatal("sliced through UTF-8")
	}
	result, err := source.Replace([]SourceEdit{{Span: Span{Start: 3, End: 5}, Text: "e"}})
	if err != nil || result != "\ufeffe\r\n\x00😀" {
		t.Fatalf("%q %v", result, err)
	}
	if _, err := source.Replace([]SourceEdit{{Span: Span{Start: 3, End: 5}, Text: "e"}, {Span: Span{Start: 3, End: 5}, Text: "x"}}); err == nil {
		t.Fatal("accepted overlapping edits")
	}
}

func TestSnapshotPreservesSourceAndOwnsItsBytes(t *testing.T) {
	source := "\ufeffA\r\n\x00é😀"
	document := &Document{Source: source, Children: []Node{{Kind: "text", Span: Span{End: uint32(len(source))}, Data: &testPayload{}}}}
	validated, err := ValidateDocument(document, testFactory)
	if err != nil {
		t.Fatal(err)
	}
	document.Source = "mutated"
	document.Children[0].Span.End = 0
	raw := validated.JSON()
	copy(raw, bytes.Repeat([]byte{'x'}, len(raw)))
	received, err := DecodeDocument(validated.JSON(), testFactory)
	if err != nil {
		t.Fatal(err)
	}
	if received.Source != source || received.Children[0].Span.End != uint32(len(source)) {
		t.Fatal("snapshot changed")
	}
	paired, err := DecodeDocument([]byte(`{"source":"\ud83d\ude00","children":[]}`), testFactory)
	if err != nil || paired.Source != "😀" {
		t.Fatalf("%+v %v", paired, err)
	}
}

func TestSnapshotRejectsCycleAndInvalidGoUTF8(t *testing.T) {
	nodes := []Node{{Kind: "text", Span: Span{End: 1}, Data: &testPayload{}}}
	nodes[0].Children = nodes
	if _, err := ValidateDocument(&Document{Source: "x", Children: nodes}, testFactory); err == nil {
		t.Fatal("accepted cycle")
	}
	if _, err := ValidateDocument(&Document{Source: string([]byte{255})}, testFactory); err == nil {
		t.Fatal("accepted invalid UTF-8")
	}
}

func TestJSONUnicodeValidationUnderEscapes(t *testing.T) {
	for _, value := range []string{`\ud800`, "😀", "a\\\"b", "\x00"} {
		raw, _ := json.Marshal(value)
		if err := ValidateJSON(raw); err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
	}
}
