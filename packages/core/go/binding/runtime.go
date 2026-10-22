// Package binding implements the generated Markdown Wasm ABI, independent of presets.
package binding

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
	"sync/atomic"
	"unicode/utf8"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
)

type Operation struct {
	Export        string
	Input         string
	Params        []string
	Result        string
	Configuration bool
}
type Signature struct {
	Params  []string
	Results []string
}
type Artifact struct {
	ContractID  string
	InputBytes  int
	OutputBytes int
	MemoryPages uint32
	Exports     map[string]Signature
	DecodeError func(json.RawMessage) (*Error, error)
}

// Error is shared by domain failures and host transport/lifecycle failures.
type Error struct {
	Code        string    `json:"code"`
	Message     string    `json:"message"`
	Resource    string    `json:"resource,omitempty"`
	Path        string    `json:"path,omitempty"`
	Offset      *uint32   `json:"offset,omitempty"`
	Span        *ast.Span `json:"span,omitempty"`
	Phase       string    `json:"phase,omitempty"`
	Rule        string    `json:"rule,omitempty"`
	PayloadType string    `json:"payload_type,omitempty"`
}

func (e *Error) Error() string            { return e.Code + ": " + e.Message }
func failure(code, message string) *Error { return &Error{Code: code, Message: message} }
func resource(name string) *Error {
	return &Error{Code: "resource_limit", Message: name + " limit exceeded", Resource: name}
}

type Runtime struct {
	runtime  wazero.Runtime
	compiled wazero.CompiledModule
	artifact Artifact
	closed   atomic.Bool
}

// Instance serializes calls. A trap or malformed reply permanently closes it.
type Instance struct {
	artifact Artifact
	module   api.Module
	gate     chan struct{}
}

func NewRuntime(ctx context.Context, wasm []byte, artifact Artifact) (*Runtime, error) {
	if artifact.ContractID == "" || artifact.InputBytes <= 0 || artifact.OutputBytes <= 0 || artifact.MemoryPages == 0 || len(artifact.Exports) == 0 {
		return nil, failure("contract_mismatch", "incomplete artifact descriptor")
	}
	rt := wazero.NewRuntimeWithConfig(ctx, wazero.NewRuntimeConfig().WithMemoryLimitPages(artifact.MemoryPages).WithCloseOnContextDone(true))
	compiled, err := rt.CompileModule(ctx, wasm)
	if err != nil {
		rt.Close(context.Background())
		return nil, failure("transport_error", err.Error())
	}
	if err := validateExports(compiled, artifact.Exports); err != nil {
		rt.Close(context.Background())
		return nil, err
	}
	return &Runtime{runtime: rt, compiled: compiled, artifact: artifact}, nil
}
func validateExports(compiled wazero.CompiledModule, signatures map[string]Signature) error {
	if compiled.ExportedMemories()["memory"] == nil {
		return failure("contract_mismatch", "missing Wasm memory")
	}
	for name, signature := range signatures {
		function := compiled.ExportedFunctions()[name]
		if function == nil || !matches(function.ParamTypes(), signature.Params) || !matches(function.ResultTypes(), signature.Results) {
			return failure("contract_mismatch", "invalid Wasm export signature: "+name)
		}
	}
	return nil
}
func matches(actual []api.ValueType, expected []string) bool {
	if len(actual) != len(expected) {
		return false
	}
	for i, value := range expected {
		if value != "i32" || actual[i] != api.ValueTypeI32 {
			return false
		}
	}
	return true
}
func (r *Runtime) Close(ctx context.Context) error { r.closed.Store(true); return r.runtime.Close(ctx) }
func (r *Runtime) NewInstance(ctx context.Context, operation Operation, config string) (*Instance, error) {
	if r.closed.Load() {
		return nil, failure("disposed", "Wasm runtime is closed")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if !operation.Configuration {
		return nil, failure("invalid_request", "instance requires a configuration operation")
	}
	module, err := r.runtime.InstantiateModule(ctx, r.compiled, wazero.NewModuleConfig().WithName(""))
	if err != nil {
		return nil, failure("transport_error", err.Error())
	}
	p := &Instance{artifact: r.artifact, module: module, gate: make(chan struct{}, 1)}
	if _, err := p.call(ctx, operation, config); err != nil {
		p.Close(context.Background())
		return nil, err
	}
	return p, nil
}
func (p *Instance) Close(ctx context.Context) error { return p.module.Close(ctx) }
func (p *Instance) Call(ctx context.Context, operation Operation, input string, args ...uint64) (json.RawMessage, error) {
	select {
	case p.gate <- struct{}{}:
		defer func() { <-p.gate }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return p.call(ctx, operation, input, args...)
}
func (p *Instance) poison(err error) error {
	p.module.Close(context.Background())
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	var typed *Error
	if errors.As(err, &typed) {
		return err
	}
	return failure("transport_error", err.Error())
}
func (p *Instance) call(ctx context.Context, operation Operation, input string, args ...uint64) (json.RawMessage, error) {
	if p.module.IsClosed() {
		return nil, failure("disposed", "Wasm instance is closed")
	}
	if len(args) != len(operation.Params) {
		return nil, failure("invalid_request", "wrong operation argument count")
	}
	signature, ok := p.artifact.Exports[operation.Export]
	if !ok || len(signature.Params) != len(args) {
		return nil, failure("invalid_request", "unsupported operation")
	}
	for _, arg := range args {
		if arg > uint64(^uint32(0)) {
			return nil, failure("invalid_request", "operation argument is outside i32")
		}
	}
	if len(input) > p.artifact.InputBytes {
		return nil, resource("input_bytes")
	}
	if !utf8.ValidString(input) {
		return nil, failure("invalid_utf8", "input is not valid UTF-8")
	}
	pointer, err := p.invoke(ctx, "input_ptr", uint64(len(input)))
	if err != nil {
		return nil, p.poison(err)
	}
	if pointer == 0 {
		return nil, p.poison(failure("transport_error", "Wasm rejected bounded input allocation"))
	}
	if !p.module.Memory().Write(pointer, []byte(input)) {
		return nil, p.poison(failure("transport_error", "invalid Wasm input range"))
	}
	length, err := p.invoke(ctx, operation.Export, args...)
	if err != nil {
		return nil, p.poison(err)
	}
	if length == 0 || uint64(length) > uint64(p.artifact.OutputBytes) {
		return nil, p.poison(failure("transport_error", "invalid Wasm output length"))
	}
	pointer, err = p.invoke(ctx, "output_ptr")
	if err != nil {
		return nil, p.poison(err)
	}
	output, ok := p.module.Memory().Read(pointer, length)
	if !ok {
		return nil, p.poison(failure("transport_error", "invalid Wasm output range"))
	}
	result, err := decodeReply(output, operation, p.artifact.ContractID, p.artifact.DecodeError)
	var typed *Error
	if err != nil && (!errors.As(err, &typed) || typed.Code == "transport_error" || typed.Code == "contract_mismatch") {
		return nil, p.poison(err)
	}
	return result, err
}
func (p *Instance) invoke(ctx context.Context, name string, args ...uint64) (uint32, error) {
	function := p.module.ExportedFunction(name)
	if function == nil {
		return 0, failure("transport_error", "missing Wasm export: "+name)
	}
	values, err := function.Call(ctx, args...)
	if err != nil {
		if ctx.Err() != nil {
			return 0, ctx.Err()
		}
		return 0, err
	}
	if len(values) != 1 || values[0] > uint64(^uint32(0)) {
		return 0, failure("transport_error", "invalid Wasm result: "+name)
	}
	return uint32(values[0]), nil
}
func decodeReply(output []byte, operation Operation, contractID string, decodeError func(json.RawMessage) (*Error, error)) (json.RawMessage, error) {
	malformed := func() (json.RawMessage, error) { return nil, failure("transport_error", "malformed Wasm reply") }
	if contract.ValidateJSON(output) != nil {
		return malformed()
	}
	var reply map[string]json.RawMessage
	if json.Unmarshal(output, &reply) != nil || len(reply) != 1 {
		return malformed()
	}
	if raw, ok := reply["error"]; ok {
		if decodeError == nil {
			return malformed()
		}
		result, err := decodeError(raw)
		if err != nil || result == nil || result.Message == "" {
			return malformed()
		}
		return nil, result
	}

	raw, ok := reply["ok"]
	if !ok {
		return malformed()
	}
	if operation.Configuration {
		var config map[string]json.RawMessage
		var received string
		if json.Unmarshal(raw, &config) != nil || len(config) != 1 || json.Unmarshal(config["contractId"], &received) != nil || received == "" {
			return malformed()
		}
		if received != contractID {
			return nil, failure("contract_mismatch", "Wasm contract does not match this SDK")
		}
	}
	if operation.Result == "text" {
		var text string
		if json.Unmarshal(raw, &text) != nil {
			return malformed()
		}
	}
	if bytes.Equal(raw, []byte("null")) {
		return malformed()
	}
	return raw, nil
}

// DocumentError preserves structured validation diagnostics in the ABI error family.
func DocumentError(err error) error {
	var validation *ast.ValidationError
	if errors.As(err, &validation) {
		code := "invalid_document"
		if validation.Resource != "" {
			code = "resource_limit"
		}
		return &Error{Code: code, Message: validation.Message, Path: validation.Path, Resource: validation.Resource, Span: validation.Span}
	}
	return failure("invalid_document", fmt.Sprint(err))
}
