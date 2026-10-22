package markdown

import (
	"context"
	"encoding/json"
	"unicode/utf8"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

// PlainTextRenderer renders an AST using the traQ PlainText policy owned by Rust.
type PlainTextRenderer struct{ instance *binding.Instance }

func (r *Runtime) NewPlainTextRenderer(ctx context.Context, options RendererOptions) (*PlainTextRenderer, error) {
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

	instance, err := r.runtime.NewInstance(ctx, operationConfigureRenderer, string(config))
	if err != nil {
		return nil, err
	}

	return &PlainTextRenderer{instance: instance}, nil
}

func (r *PlainTextRenderer) Render(ctx context.Context, document *Document) (string, error) {
	validated, err := ValidateDocument(document)
	if err != nil {
		return "", binding.DocumentError(err)
	}
	return r.RenderValidated(ctx, validated)
}

// RenderValidated reuses an immutable document snapshot.
func (r *PlainTextRenderer) RenderValidated(ctx context.Context, document *ValidatedDocument) (string, error) {
	if document == nil {
		return "", &Error{Code: "invalid_document", Message: "document is required"}
	}

	raw, err := r.instance.Call(ctx, operationRender, string(document.JSON()))
	if err != nil {
		return "", err
	}

	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		r.instance.Close(context.Background())
		return "", &Error{Code: "transport_error", Message: "Wasm returned invalid text: " + err.Error()}
	}

	return text, nil
}

func (r *PlainTextRenderer) Close(ctx context.Context) error {
	return r.instance.Close(ctx)
}
