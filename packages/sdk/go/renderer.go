package markdown

import (
	"context"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

// PlainTextRenderer renders an AST using the traQ PlainText policy owned by Rust.
type PlainTextRenderer struct{ instance *binding.Instance }

func (r *Runtime) NewPlainTextRenderer(ctx context.Context, options RendererOptions) (*PlainTextRenderer, error) {
	instance, err := r.configure(ctx, operationConfigureRenderer, options, options.Origin)
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

	return callDecoded(ctx, r.instance, operationRender, string(document.JSON()), decodeJSON[string])
}

func (r *PlainTextRenderer) Close(ctx context.Context) error {
	return r.instance.Close(ctx)
}
