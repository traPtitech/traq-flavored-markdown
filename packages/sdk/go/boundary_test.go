package markdown

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
)

func TestDocumentLimitsMatchGeneratedNativeContract(t *testing.T) {
	if actual := ast.DefaultLimits(); actual != documentLimits {
		t.Fatalf("Go document limits %+v differ from native contract %+v", actual, documentLimits)
	}
}

func TestConfigurationBoundsBeforeEncodingAndInstantiation(t *testing.T) {
	// A zero Runtime has no Wasm host. Oversized options must fail before using it.
	runtime := &Runtime{}
	origin := strings.Repeat("x", inputBytes+1)
	_, extractorErr := runtime.NewExtractor(context.Background(), ExtractorOptions{Origin: origin})
	_, rendererErr := runtime.NewPlainTextRenderer(context.Background(), RendererOptions{Origin: origin})
	for _, err := range []error{extractorErr, rendererErr} {
		var detail *Error
		if !errors.As(err, &detail) || detail.Code != "resource_limit" || detail.Resource != "input_bytes" {
			t.Fatalf("expected bounded configuration failure, got %v", err)
		}
	}
}

func TestSharedDocumentStructuralContract(t *testing.T) {
	raw, err := os.ReadFile("../../../tests/fixtures/document-structure.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name     string          `json:"name"`
		Valid    bool            `json:"valid"`
		Document json.RawMessage `json:"document"`
	}
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			_, err := DecodeDocument(fixture.Document)
			if (err == nil) != fixture.Valid {
				t.Fatalf("valid=%t: %v", fixture.Valid, err)
			}
		})
	}
}

func TestValidatedSnapshotsAcrossConsumers(t *testing.T) {
	ctx := context.Background()
	runtime, err := NewBundledRuntime(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer runtime.Close(ctx)
	parser, err := runtime.NewParser(ctx, PresetTraqV1)
	if err != nil {
		t.Fatal(err)
	}
	renderer, err := runtime.NewPlainTextRenderer(ctx, RendererOptions{})
	if err != nil {
		t.Fatal(err)
	}
	extractor, err := runtime.NewExtractor(ctx, ExtractorOptions{})
	if err != nil {
		t.Fatal(err)
	}
	validated, err := parser.ParseValidated(ctx, "**é😀**")
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		text, err := renderer.RenderValidated(ctx, validated)
		if err != nil || text != "é😀" {
			t.Fatalf("%q %v", text, err)
		}
		result, err := extractor.ExtractValidated(ctx, validated)
		if err != nil || result.MessageText != "**é😀**" {
			t.Fatalf("%+v %v", result, err)
		}
	}
	mutable, err := parser.Parse(ctx, "original")
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := ValidateDocument(mutable)
	if err != nil {
		t.Fatal(err)
	}
	mutable.Source = ""
	mutable.Children[0].Span.End = 0
	if text, err := renderer.RenderValidated(ctx, snapshot); err != nil || text != "original" {
		t.Fatalf("snapshot: %q %v", text, err)
	}
	if _, err := parser.Parse(ctx, string([]byte{0xff})); err == nil {
		t.Fatal("accepted invalid UTF-8")
	} else {
		var typed *Error
		if !errors.As(err, &typed) || typed.Code != "invalid_utf8" {
			t.Fatal(err)
		}
	}
	if _, err := parser.Parse(ctx, "reusable"); err != nil {
		t.Fatal(err)
	}
	if _, err := runtime.NewExtractor(ctx, ExtractorOptions{Origin: strings.Repeat("x", 2049)}); err == nil {
		t.Fatal("accepted resource excess")
	} else {
		var typed *Error
		if !errors.As(err, &typed) || typed.Code != "resource_limit" || typed.Resource != "origin_bytes" {
			t.Fatal(err)
		}
	}
}

func TestEmbeddingPreservesSourceBytesAndPreflightsCandidates(t *testing.T) {
	source := "\ufeff@é\r\n\x00"
	plan := ReferenceEmbeddingPlan{Candidates: []ReferenceEmbeddingCandidate{{Kind: LookupKindUser, Name: "é", Raw: "@é", Start: 3, End: 6}}}
	unchanged, err := EmbedReferences(source, ReferenceEmbeddingPlan{}, func(LookupKind, string) (string, bool) { t.Fatal("unexpected resolver"); return "", false })
	if err != nil || unchanged != source {
		t.Fatalf("no-op %q %v", unchanged, err)
	}
	result, err := EmbedReferences(source, plan, func(LookupKind, string) (string, bool) { return "caller-defined-id", true })
	if err != nil || !strings.HasPrefix(result, "\ufeff!{") || !strings.HasSuffix(result, "\r\n\x00") {
		t.Fatalf("%q %v", result, err)
	}
	plan.Candidates = append(plan.Candidates, ReferenceEmbeddingCandidate{Kind: LookupKindUser, Raw: "bad", Start: 4, End: 99})
	calls := 0
	if _, err := EmbedReferences(source, plan, func(LookupKind, string) (string, bool) { calls++; return "id", true }); err == nil || calls != 0 {
		t.Fatalf("malformed candidate passed resolver: %v, calls=%d", err, calls)
	}
	plan.Candidates = plan.Candidates[:1]
	if _, err := EmbedReferences(source, plan, func(LookupKind, string) (string, bool) { return string([]byte{0xff}), true }); err == nil {
		t.Fatal("accepted lossy identifier")
	}
}

func TestEmbeddingResolverCannotChangeValidatedPlan(t *testing.T) {
	plan := ReferenceEmbeddingPlan{Candidates: []ReferenceEmbeddingCandidate{
		{Kind: LookupKindUser, Name: "a", Raw: "@a", Start: 0, End: 2},
		{Kind: LookupKindUser, Name: "b", Raw: "@b", Start: 3, End: 5},
	}}
	var seen []string
	output, err := EmbedReferences("@a @b", plan, func(_ LookupKind, name string) (string, bool) {
		seen = append(seen, name)
		plan.Candidates[1].End = 1000
		plan.Candidates[1].Name = "changed"
		return name, true
	})
	if err != nil || strings.Join(seen, ",") != "a,b" || !strings.Contains(output, `"id":"b"`) {
		t.Fatalf("plan changed after validation: %q %+v %v", output, seen, err)
	}
}
