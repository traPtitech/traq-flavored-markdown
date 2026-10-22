package markdown

import (
	"encoding/json"
	"testing"
)

func TestOptionsUseDefaultWhitespace(t *testing.T) {
	const origin = "https://q.example.test"
	for _, test := range []struct {
		name    string
		options any
		decoded any
	}{
		{"processor", ProcessorOptions{}, &ProcessorOptions{}},
		{"renderer", RendererOptions{Origin: origin}, &RendererOptions{}},
		{"configuration", ProcessorConfiguration{Preset: "traq.v1"}, &ProcessorConfiguration{}},
	} {
		t.Run(test.name, func(t *testing.T) {
			raw, err := json.Marshal(test.options)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(raw, test.decoded); err != nil {
				t.Fatal(err)
			}
			var whitespace WhitespacePolicy
			switch value := test.decoded.(type) {
			case *ProcessorOptions:
				whitespace = value.Whitespace
			case *RendererOptions:
				whitespace = value.Whitespace
				if value.Origin != origin {
					t.Fatalf("lost renderer origin: %s", raw)
				}
			case *ProcessorConfiguration:
				whitespace = value.Options.Whitespace
				if value.Preset != "traq.v1" {
					t.Fatalf("lost processor preset: %s", raw)
				}
			}
			if whitespace != WhitespacePolicyCollapse {
				t.Fatalf("wrong whitespace default %q: %s", whitespace, raw)
			}
		})
	}
}

func TestOptionsPreserveExplicitWhitespace(t *testing.T) {
	value := ProcessorOptions{Whitespace: WhitespacePolicyPreserve}
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var decoded ProcessorOptions
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Whitespace != WhitespacePolicyPreserve {
		t.Fatalf("lost explicit whitespace policy: %s", raw)
	}
}
