package markdown

import (
	"context"
	"os"
	"sync"
	"testing"

	commonmark "github.com/traq-markdown-parser/commonmark/go"
	trap "github.com/traq-markdown-parser/trap-extension/go"
)

func TestRuntimeOwnership(t *testing.T) {
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

	traq, err := runtime.NewParser(ctx, PresetTraQV1)
	if err != nil {
		t.Fatal(err)
	}

	common, err := runtime.NewParser(ctx, PresetCommonMark)
	if err != nil {
		t.Fatal(err)
	}

	for parser, kind := range map[*Parser]string{
		traq:   trap.StampName,
		common: commonmark.TextName,
	} {
		doc, err := parser.ParseInline(ctx, ":stamp:")
		if err != nil {
			t.Fatal(err)
		}
		if doc.Children[0].Kind != kind {
			t.Fatal("parser grammars were shared")
		}
	}

	if _, err := runtime.NewParser(ctx, Preset("missing")); err == nil {
		t.Fatal("accepted invalid preset")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()

	if parser, err := runtime.NewParser(canceled, PresetTraQV1); err == nil {
		parser.Close(ctx)
		t.Fatal("accepted canceled creation")
	}
	if err := traq.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := common.Parse(ctx, "still open"); err != nil {
		t.Fatal(err)
	}

	// Creation and parsing share only the compiled module, including after a failure or Close.
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p, err := runtime.NewParser(ctx, PresetTraQV1)
			if err != nil {
				t.Error(err)
				return
			}
			defer p.Close(ctx)
			if _, err := p.Parse(ctx, "**parallel**"); err != nil {
				t.Error(err)
			}
		}()
	}

	wg.Wait()

	if err := runtime.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Close(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := common.Parse(ctx, "closed"); err == nil {
		t.Fatal("Runtime.Close left a parser open")
	}
	if _, err := runtime.NewParser(ctx, PresetTraQV1); err == nil {
		t.Fatal("closed Runtime created a parser")
	}
	if err := common.Close(ctx); err != nil {
		t.Fatal(err)
	}
}
