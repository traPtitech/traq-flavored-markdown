// Package markdown selects traQ presets and pairs them with the distributed Wasm.
package markdown

import (
	"context"

	"github.com/traq-markdown-parser/core/go/binding"
)

type Runtime struct{ runtime *binding.Runtime }
type Parser struct{ instance *binding.Instance }

func NewRuntime(ctx context.Context, wasm []byte) (*Runtime, error) {
	runtime, err := binding.NewRuntime(
		ctx,
		wasm,
		binding.Artifact{
			BuildID:     buildID,
			InputBytes:  inputBytes,
			MemoryPages: memoryPages,
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
	instance, err := r.runtime.NewInstance(ctx, "configure", string(preset))
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

func (p *Parser) parse(ctx context.Context, source string, mode uint64) (*Document, error) {
	raw, err := p.instance.Call(ctx, "parse", source, mode)
	if err != nil {
		return nil, err
	}
	return DecodeDocument(raw)
}
