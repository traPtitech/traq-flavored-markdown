package ast

import (
	"encoding/json"
	"testing"
)

func benchmarkDocument(b *testing.B, width, depth int) []byte {
	b.Helper()
	children := make([]MutableNode, width)

	for i := range children {
		children[i] = MutableNode{Kind: "custom", Data: &nestedPayload{Values: []string{"日😀", "payload"}}}
	}

	for i := 1; i < depth; i++ {
		children = []MutableNode{{Kind: "custom", Data: &nestedPayload{}, Children: children}}
	}

	raw, err := json.Marshal(MutableDocument{Source: "", Children: children})
	if err != nil {
		b.Fatal(err)
	}

	return raw
}

func BenchmarkDecodeDocument(b *testing.B) {
	for _, shape := range []struct {
		name         string
		width, depth int
	}{{"wide", 1000, 1}, {"deep", 1, 64}} {
		b.Run(shape.name, func(b *testing.B) {
			raw := benchmarkDocument(b, shape.width, shape.depth)
			factory := func(string) Payload { return &nestedPayload{} }
			b.ReportAllocs()
			b.SetBytes(int64(len(raw)))
			b.ResetTimer()

			for b.Loop() {
				if _, err := DecodeDocument(raw, factory); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

var benchmarkJSON string

func BenchmarkDocumentTransport(b *testing.B) {
	raw := benchmarkDocument(b, 1000, 1)
	document, err := DecodeDocument(raw, func(string) Payload { return &nestedPayload{} })
	if err != nil {
		b.Fatal(err)
	}

	b.ReportAllocs()
	b.ResetTimer()

	for b.Loop() {
		benchmarkJSON = document.JSONText()
	}
}
