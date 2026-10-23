package markdown

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

func TestFusedProcessing(t *testing.T) {
	ctx := context.Background()
	runtime, err := NewBundledRuntime(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer runtime.Close(ctx)
	origin := "https://q.example.test"
	source := "**hello**\n\n" + origin + "/files/00000000-0000-0000-0000-000000000001"
	parser, err := runtime.NewParser(ctx, PresetTraqV1)
	if err != nil {
		t.Fatal(err)
	}
	extractor, err := runtime.NewExtractor(ctx, ExtractorOptions{Origin: origin})
	if err != nil {
		t.Fatal(err)
	}
	renderer, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{Origin: origin})
	if err != nil {
		t.Fatal(err)
	}
	processor, err := runtime.NewProcessor(ctx, PresetTraqV1, ProcessorOptions{Origin: origin})
	if err != nil {
		t.Fatal(err)
	}
	for _, inline := range []bool{false, true} {
		parse, process := parser.Parse, processor.Process
		if inline {
			parse, process = parser.ParseInline, processor.ProcessInline
		}
		document, err := parse(ctx, source)
		if err != nil {
			t.Fatal(err)
		}
		extraction, err := extractor.Extract(ctx, document)
		if err != nil {
			t.Fatal(err)
		}
		text, err := renderer.Render(ctx, document)
		if err != nil {
			t.Fatal(err)
		}
		result, err := process(ctx, source)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(result.Document, document) || !reflect.DeepEqual(result.Extraction, *extraction) || result.PlainText != text {
			t.Fatalf("fused result differs: %+v", result)
		}
	}
	preserved, err := runtime.NewProcessor(ctx, PresetTraqV1, ProcessorOptions{Whitespace: WhitespacePolicyPreserve})
	if err != nil {
		t.Fatal(err)
	}
	result, err := preserved.Process(ctx, "a\n\nb")
	if err != nil || !strings.Contains(result.PlainText, "\n") {
		t.Fatalf("whitespace policy: %+v, %v", result, err)
	}
	processor.Close(ctx)
	if _, err := processor.Process(ctx, source); err == nil {
		t.Fatal("disposed processor accepted a call")
	}
}
