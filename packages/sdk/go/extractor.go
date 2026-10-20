package markdown

import (
	"context"
	"encoding/json"
	"unicode/utf8"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

type Extractor struct{ instance *binding.Instance }

func (p *Extractor) Close(ctx context.Context) error { return p.instance.Close(ctx) }

func (r *Runtime) NewExtractor(
	ctx context.Context,
	options ExtractorOptions,
) (*Extractor, error) {
	if len(options.Origin) > inputBytes {
		return nil, &Error{Code: "resource_limit", Resource: "input_bytes", Message: "input_bytes limit exceeded"}
	}
	if !utf8.ValidString(options.Origin) {
		return nil, &Error{Code: "invalid_utf8", Message: "origin is not valid UTF-8"}
	}
	config, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}

	instance, err := r.runtime.NewInstance(ctx, operationConfigureExtractor, string(config))
	if err != nil {
		return nil, err
	}

	return &Extractor{instance: instance}, nil
}

func (p *Extractor) Extract(ctx context.Context, document *Document) (*Extraction, error) {
	validated, err := ValidateDocument(document)
	if err != nil {
		return nil, binding.DocumentError(err)
	}
	return p.ExtractValidated(ctx, validated)
}

// ExtractValidated reuses an immutable document snapshot.
func (p *Extractor) ExtractValidated(ctx context.Context, document *ValidatedDocument) (*Extraction, error) {
	if document == nil {
		return nil, &Error{Code: "invalid_document", Message: "document is required"}
	}

	raw, err := p.instance.Call(ctx, operationExtract, string(document.JSON()))
	if err != nil {
		return nil, err
	}

	var result Extraction
	if err := json.Unmarshal(raw, &result); err != nil {
		p.instance.Close(context.Background())
		return nil, &Error{Code: "transport_error", Message: "Wasm returned an invalid extraction: " + err.Error()}
	}

	return &result, nil
}
