package markdown

import (
	"context"
	"encoding/json"

	"github.com/traq-markdown-parser/core/go/binding"
)

// PlainTextRenderer renders an AST using the traQ PlainText policy owned by Rust.
type PlainTextRenderer struct{ instance *binding.Instance }

func (r *Runtime) NewPlainTextRenderer(ctx context.Context, options RendererOptions) (*PlainTextRenderer, error) {
	config, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}

	instance, err := r.runtime.NewInstance(ctx, "configure_renderer", string(config))
	if err != nil {
		return nil, err
	}

	return &PlainTextRenderer{instance: instance}, nil
}

func (r *PlainTextRenderer) Render(ctx context.Context, document *Document) (string, error) {
	input, err := json.Marshal(document)
	if err != nil {
		return "", err
	}

	raw, err := r.instance.Call(ctx, "render", string(input))
	if err != nil {
		return "", err
	}

	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return "", err
	}

	return text, nil
}

func (r *PlainTextRenderer) Close(ctx context.Context) error {
	return r.instance.Close(ctx)
}
