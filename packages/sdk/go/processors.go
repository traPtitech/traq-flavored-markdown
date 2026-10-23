package markdown

import (
	"context"
	"encoding/json"
	"unicode/utf8"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

// Configuration validation and transport ownership are shared by processor facades.
func (r *Runtime) configure(ctx context.Context, operation binding.Operation, options any, origin string) (*binding.Instance, error) {
	if len(origin) > inputBytes {
		return nil, &Error{Code: "resource_limit", Resource: "input_bytes", Message: "input_bytes limit exceeded"}
	}
	if !utf8.ValidString(origin) {
		return nil, &Error{Code: "invalid_utf8", Message: "origin is not valid UTF-8"}
	}
	config, err := json.Marshal(options)
	if err != nil {
		return nil, err
	}
	return r.runtime.NewInstance(ctx, operation, string(config))
}

func decodeJSON[T any](raw []byte) (result T, err error) {
	err = json.Unmarshal(raw, &result)
	return
}

// Malformed successes poison their instance consistently, regardless of result type.
func callDecoded[T any](ctx context.Context, instance *binding.Instance, operation binding.Operation, input string, decode func([]byte) (T, error), params ...uint64) (result T, err error) {
	raw, err := instance.Call(ctx, operation, input, params...)
	if err != nil {
		return result, err
	}
	result, err = decode(raw)
	if err != nil {
		instance.Close(context.Background())
		return result, &Error{Code: "transport_error", Message: "Wasm returned an invalid " + operation.Result + ": " + err.Error()}
	}
	return result, nil
}
