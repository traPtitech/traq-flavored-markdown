// Package markdown selects traQ presets and pairs them with the distributed Wasm.
package markdown

import (
	"context"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

type Runtime struct{ runtime *binding.Runtime }
type Parser struct{ instance *binding.Instance }

func NewRuntime(ctx context.Context, wasm []byte) (*Runtime, error) {
	runtime, err := binding.NewRuntime(
		ctx,
		wasm,
		binding.Artifact{
			ContractID:  contractID,
			InputBytes:  inputBytes,
			OutputBytes: outputBytes,
			MemoryPages: memoryPages,
			Exports:     abiExports,
			ErrorCodes:  wireErrorCodes,
		},
	)
	if err != nil {
		return nil, err
	}
	return &Runtime{runtime: runtime}, nil
}

func (r *Runtime) Close(ctx context.Context) error { return r.runtime.Close(ctx) }
func (p *Parser) Close(ctx context.Context) error  { return p.instance.Close(ctx) }

func (r *Runtime) NewParser(ctx context.Context, preset Preset) (*Parser, error) {
	instance, err := r.runtime.NewInstance(ctx, operationConfigure, string(preset))
	if err != nil {
		return nil, err
	}
	return &Parser{instance: instance}, nil
}

func (p *Parser) Parse(ctx context.Context, source string) (*Document, error) {
	return p.parse(ctx, source, 0)
}
func (p *Parser) ParseInline(ctx context.Context, source string) (*Document, error) {
	return p.parse(ctx, source, 1)
}

// ParseValidated returns an immutable snapshot reusable by AST consumers.
func (p *Parser) ParseValidated(ctx context.Context, source string) (*ValidatedDocument, error) {
	return p.parseValidated(ctx, source, 0)
}
func (p *Parser) ParseInlineValidated(ctx context.Context, source string) (*ValidatedDocument, error) {
	return p.parseValidated(ctx, source, 1)
}
func (p *Parser) parseValidated(ctx context.Context, source string, mode uint64) (*ValidatedDocument, error) {
	return callDecoded(ctx, p.instance, operationParse, source, func(raw []byte) (*ValidatedDocument, error) {
		return ast.DecodeValidatedDocument(raw, newPayload)
	}, mode)
}

func (p *Parser) parse(ctx context.Context, source string, mode uint64) (*Document, error) {
	return callDecoded(ctx, p.instance, operationParse, source, DecodeDocument, mode)
}
