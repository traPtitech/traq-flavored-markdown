package ast

import (
	"encoding/json"
	"strings"
	"testing"
)

type testPayload struct{}

func (*testPayload) NodePayload() {}

func testFactory(kind string) Payload {
	if kind == "text" {
		return &testPayload{}
	}
	return nil
}

func TestDecodeDocumentValidatesStructuralLimits(t *testing.T) {
	const node = `{"kind":"text","span":{"start":0,"end":1},"data":{}}`
	valid := []byte(`{"source":"a","children":[` + node + `]}`)
	if _, err := DecodeDocument(valid, testFactory); err != nil {
		t.Fatalf("valid document: %v", err)
	}

	deep := node
	for range maxDocumentDepth {
		deep = `{"kind":"text","span":{"start":0,"end":1},"data":{},"children":[` + deep + `]}`
	}

	cases := []struct {
		name string
		raw  []byte
		want string
	}{
		{"utf8 span", []byte(`{"source":"é","children":[{"kind":"text","span":{"start":1,"end":2},"data":{}}]}`), "invalid node span"},
		{"nested span", []byte(`{"source":"ab","children":[{"kind":"text","span":{"start":0,"end":1},"data":{},"children":[{"kind":"text","span":{"start":1,"end":2},"data":{}}]}]}`), "invalid node span"},
		{"depth", []byte(`{"source":"a","children":[` + deep + `]}`), "node depth limit"},
		{"nodes", []byte(`{"source":"a","children":[` + strings.TrimSuffix(strings.Repeat(node+",", maxDocumentNodes+1), ",") + `]}`), "node count limit"},
		{"JSON bytes", []byte(strings.Repeat(" ", maxJSONBytes+1)), "JSON byte limit"},
	}
	longSource, err := json.Marshal(struct {
		Source   string `json:"source"`
		Children []Node `json:"children"`
	}{Source: strings.Repeat("x", maxSourceBytes+1)})
	if err != nil {
		t.Fatal(err)
	}
	cases = append(cases, struct {
		name string
		raw  []byte
		want string
	}{"source bytes", longSource, "source byte limit"})

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if _, err := DecodeDocument(test.raw, testFactory); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("expected %q, got %v", test.want, err)
			}
		})
	}
}
