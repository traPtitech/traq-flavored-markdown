package markdown

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
)

func TestASTConsumers(t *testing.T) {
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

	parser, err := runtime.NewParser(ctx, PresetTraQV1)
	if err != nil {
		t.Fatal(err)
	}

	parse := func(source string) *Document {
		doc, err := parser.Parse(ctx, source)
		if err != nil {
			t.Fatal(err)
		}

		return doc
	}

	extractor, err := runtime.NewExtractor(ctx, ExtractorOptions{Origin: "https://q.example.test"})
	if err != nil {
		t.Fatal(err)
	}

	renderer, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{Origin: "https://q.example.test"})
	if err != nil {
		t.Fatal(err)
	}

	plain, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{})
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../tests/fixtures/processing-notifications.json")
	if err != nil {
		t.Fatal(err)
	}

	var fixtures []struct{ Name, Source, Notification string }
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}

	if len(fixtures) != 787 {
		t.Fatal(len(fixtures))
	}

	for _, fixture := range fixtures {
		text, err := renderer.Render(ctx, parse(fixture.Source))
		if err != nil || text != fixture.Notification {
			t.Fatalf("%s: got %q, want %q: %v", fixture.Name, text, fixture.Notification, err)
		}
	}

	const id = "00000000-0000-0000-0000-000000000001"
	const user = `!{"type":"user","id":"` + id + `","raw":"@alice"}`

	document := parse("**" + user + "** !!" + user + "!! `" + user + "`")
	original, _ := json.Marshal(document)

	result, err := extractor.Extract(ctx, document)
	if err != nil {
		t.Fatal(err)
	}

	text, err := renderer.Render(ctx, document)
	if err != nil || text != "@alice ██████ "+user || !reflect.DeepEqual(result.References.Mentions, []string{id, id}) || !strings.HasPrefix(result.MessageText, "**@alice**") {
		t.Fatalf("%+v %q %v", result, text, err)
	}

	after, _ := json.Marshal(document)
	if string(after) != string(original) {
		t.Fatal("consumers changed document")
	}

	url := "https://q.example.test/files/" + id
	if text, err := plain.Render(ctx, parse(url)); err != nil || text != url {
		t.Fatalf("%q %v", text, err)
	}

	for _, version := range []string{"commonmark", "traq.v1", "commonmark"} {
		p, err := runtime.NewParser(ctx, Preset(version))
		if err != nil {
			t.Fatal(err)
		}

		doc, err := p.Parse(ctx, user+" !!secret!!")
		if err != nil {
			t.Fatal(err)
		}

		r, err := extractor.Extract(ctx, doc)
		if err != nil {
			t.Fatal(err)
		}

		text, err := renderer.Render(ctx, doc)
		if err != nil {
			t.Fatal(err)
		}

		if version == "commonmark" {
			if len(r.References.Mentions) != 0 || text != user+" !!secret!!" {
				t.Fatalf("%+v %q", r, text)
			}
		} else if len(r.References.Mentions) != 1 || text != "@alice ██████" {
			t.Fatalf("%+v %q", r, text)
		}

		p.Close(ctx)
	}

	invalid := parse("text")
	invalid.Children[0].Span.End++
	if _, err := extractor.Extract(ctx, invalid); err == nil {
		t.Fatal("accepted invalid AST")
	}
	if _, err := renderer.Render(ctx, invalid); err == nil {
		t.Fatal("rendered invalid AST")
	}
	if _, err := runtime.NewExtractor(ctx, ExtractorOptions{Origin: strings.Repeat("x", 2049)}); err == nil {
		t.Fatal("accepted oversized origin")
	}
	if _, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{Origin: strings.Repeat("x", 2049)}); err == nil {
		t.Fatal("accepted oversized origin")
	}

	large := parse(strings.Repeat("x", 60000))
	if r, err := extractor.Extract(ctx, large); err != nil || r.MessageText != large.Source {
		t.Fatalf("large AST: %v", err)
	}
	if text, err := renderer.Render(ctx, large); err != nil || text != large.Source {
		t.Fatalf("large AST: %v", err)
	}

	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := extractor.Extract(canceled, document); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if _, err := renderer.Render(canceled, document); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 8 {
				if r, err := extractor.Extract(ctx, document); err != nil || !reflect.DeepEqual(r, result) {
					t.Errorf("concurrent extraction: %v", err)
					return
				}
				if text, err := renderer.Render(ctx, document); err != nil || text != "@alice ██████ "+user {
					t.Errorf("concurrent rendering: %v", err)
					return
				}
			}
		}()
	}

	wg.Wait()
	extractor.Close(ctx)
	extractor.Close(ctx)

	if _, err := extractor.Extract(ctx, document); err == nil {
		t.Fatal("closed extractor accepted document")
	}
	if _, err := renderer.Render(ctx, document); err != nil {
		t.Fatal(err)
	}

	renderer.Close(ctx)
	renderer.Close(ctx)

	if _, err := renderer.Render(ctx, document); err == nil {
		t.Fatal("closed renderer accepted document")
	}
	if _, err := plain.Render(ctx, document); err != nil {
		t.Fatal(err)
	}

	runtime.Close(ctx)
	if _, err := plain.Render(ctx, document); err == nil {
		t.Fatal("runtime left renderer open")
	}
	if _, err := runtime.NewExtractor(ctx, ExtractorOptions{}); err == nil {
		t.Fatal("closed runtime accepted creation")
	}
	if _, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{}); err == nil {
		t.Fatal("closed runtime accepted creation")
	}
}
