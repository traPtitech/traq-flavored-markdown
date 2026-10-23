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
	if !document.IsValid() {
		return nil, &Error{Code: "invalid_document", Message: "document is required"}
	}

	return callDecoded(ctx, p.instance, operationExtract, string(document.JSON()), decodeJSON[*Extraction])
}
