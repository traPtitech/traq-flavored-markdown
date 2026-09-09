package markdown

import (
	"context"
	"encoding/json"
	"os"
	"testing"
)

func TestEmbeddingFixtures(t *testing.T) {
	ctx := context.Background()
	wasm, err := os.ReadFile("../dist/parser.wasm")
	if err != nil {
		t.Fatal(err)
	}

	runtime, err := NewRuntime(ctx, wasm)
	if err != nil {
		t.Fatal(err)
	}
	defer runtime.Close(ctx)

	extractor, err := runtime.NewExtractor(ctx, ExtractorOptions{})
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../tests/fixtures/embedding.json")
	if err != nil {
		t.Fatal(err)
	}

	var fixtures [][2]string
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}

	identities := map[LookupKind]map[string]string{
		"user": {
			"a":                                "dfdff0c9-5de0-46ee-9721-2525e8bb3d44",
			"takashi_trap":                     "dfdff0c9-5de0-46ee-9721-2525e8bb3d45",
			"takashi_trape":                    "dfdff0c9-5de0-46ee-9721-2525e8bb3d46",
			"very_long_long_long_long_lo_name": "dfdff0c9-5de0-46ee-9721-2525e8bb3d47",
		},
		"group": {
			"okあok":         "dfabf0c9-5de0-46ee-9721-2525e8bb3d45",
			"takashi_trapo": "dfabf0c9-5de0-46ee-9721-2525e8bb3d46",
		},
		"channel": {
			"a": "ea452867-553b-4808-a14f-a47ee0009ee6",
		},
	}

	resolve := func(kind LookupKind, name string) (string, bool) {
		id, ok := identities[kind][name]
		return id, ok
	}

	parser, err := runtime.NewParser(ctx, PresetTraQV1)
	if err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		document, err := parser.Parse(ctx, fixture[0])
		if err != nil {
			t.Fatal(err)
		}
		output, err := extractor.Extract(ctx, document)
		if err != nil {
			t.Fatal(err)
		}

		actual, err := EmbedReferences(fixture[0], output.Embedding, resolve)
		if err != nil {
			t.Fatal(err)
		}

		if actual != fixture[1] {
			t.Errorf("source %q\ngot  %s\nwant %s", fixture[0], actual, fixture[1])
		}
	}
}
