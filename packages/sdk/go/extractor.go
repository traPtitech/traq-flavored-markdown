package markdown

import (
	"context"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

type Extractor struct{ instance *binding.Instance }

func (p *Extractor) Close(ctx context.Context) error { return p.instance.Close(ctx) }

func (r *Runtime) NewExtractor(
	ctx context.Context,
	options ExtractorOptions,
) (*Extractor, error) {
	instance, err := r.configure(ctx, operationConfigureExtractor, options, options.Origin)
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

	return callDecoded(ctx, p.instance, operationExtract, string(document.JSON()), decodeJSON[*Extraction])
}
