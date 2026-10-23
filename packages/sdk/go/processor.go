package markdown

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

// ProcessedDocument contains the original AST and its native processing results.
type ProcessedDocument struct {
	Document   *Document  `json:"document"`
	Extraction Extraction `json:"extraction"`
	PlainText  string     `json:"plainText"`
}

type Processor struct{ instance *binding.Instance }

func (r *Runtime) NewProcessor(ctx context.Context, preset GrammarPresetID, options ProcessorOptions) (*Processor, error) {
	config := ProcessorConfiguration{Preset: string(preset), Options: options}
	instance, err := r.configure(ctx, operationConfigureProcessor, config, options.Origin)
	if err != nil {
		return nil, err
	}
	return &Processor{instance}, nil
}

func (p *Processor) Close(ctx context.Context) error { return p.instance.Close(ctx) }
func (p *Processor) Process(ctx context.Context, source string) (*ProcessedDocument, error) {
	return callDecoded(ctx, p.instance, operationProcess, source, decodeProcessed, 0)
}
func (p *Processor) ProcessInline(ctx context.Context, source string) (*ProcessedDocument, error) {
	return callDecoded(ctx, p.instance, operationProcess, source, decodeProcessed, 1)
}

func decodeProcessed(raw []byte) (*ProcessedDocument, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, err
	}
	if len(fields) != 3 || fields["document"] == nil || fields["extraction"] == nil || fields["plainText"] == nil {
		return nil, fmt.Errorf("expected document, extraction and plainText")
	}
	document, err := DecodeDocument(fields["document"])
	if err != nil {
		return nil, err
	}
	extraction, err := decodeJSON[Extraction](fields["extraction"])
	if err != nil {
		return nil, err
	}
	text, err := decodeJSON[*string](fields["plainText"])
	if err != nil {
		return nil, err
	}
	if text == nil {
		return nil, fmt.Errorf("plainText must be a string")
	}
	return &ProcessedDocument{document, extraction, *text}, nil
}
