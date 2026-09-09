package markdown

import (
	"context"
	"encoding/json"

	"github.com/traq-markdown-parser/core/go/binding"
)

type Extractor struct{ instance *binding.Instance }

func (p *Extractor) Close(ctx context.Context) error { return p.instance.Close(ctx) }

func (r *Runtime) NewExtractor(
	ctx context.Context,
	options ExtractorOptions,
) (*Extractor, error) {
	config, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}

	instance, err := r.runtime.NewInstance(ctx, "configure_extractor", string(config))
	if err != nil {
		return nil, err
	}

	return &Extractor{instance: instance}, nil
}

func (p *Extractor) Extract(ctx context.Context, document *Document) (*Extraction, error) {
	input, err := json.Marshal(document)
	if err != nil {
		return nil, err
	}

	raw, err := p.instance.Call(ctx, "extract", string(input))
	if err != nil {
		return nil, err
	}

	var result Extraction
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}

	return &result, nil
}
