// Package binding implements the shared Markdown Wasm ABI, independent of presets.
package binding

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
)

// Runtime compiles Wasm once and owns its parser and processor instances.
type Runtime struct {
	runtime  wazero.Runtime
	compiled wazero.CompiledModule
	artifact Artifact
}

// Artifact pairs the Rust build identity with its generated resource limits.
type Artifact struct {
	BuildID     string
	InputBytes  int
	MemoryPages uint32
}

// Instance owns one serialized Wasm execution context. Cancellation during a call closes it.
type Instance struct {
	artifact Artifact
	module   api.Module
	gate     chan struct{}
}

func NewRuntime(ctx context.Context, wasm []byte, artifact Artifact) (*Runtime, error) {
	rt := wazero.NewRuntimeWithConfig(ctx, wazero.NewRuntimeConfig().WithMemoryLimitPages(artifact.MemoryPages).WithCloseOnContextDone(true))
	compiled, err := rt.CompileModule(ctx, wasm)
	if err != nil {
		rt.Close(context.Background())
		return nil, err
	}

	if err := validateExports(compiled); err != nil {
		rt.Close(context.Background())
		return nil, err
	}

	return &Runtime{runtime: rt, compiled: compiled, artifact: artifact}, nil
}

func validateExports(compiled wazero.CompiledModule) error {
	if compiled.ExportedMemories()["memory"] == nil {
		return fmt.Errorf("invalid parser Wasm exports")
	}

	for _, name := range []string{"input_ptr", "output_ptr", "configure", "parse"} {
		if compiled.ExportedFunctions()[name] == nil {
			return fmt.Errorf("invalid parser Wasm exports")
		}
	}

	return nil
}

// Close releases the compiled module and all parsers created by this Runtime.
func (r *Runtime) Close(ctx context.Context) error { return r.runtime.Close(ctx) }

// NewInstance configures an independent instance of the compiled module.
func (r *Runtime) NewInstance(ctx context.Context, operation, config string) (*Instance, error) {
	module, err := r.runtime.InstantiateModule(ctx, r.compiled, wazero.NewModuleConfig().WithName(""))
	if err != nil {
		return nil, err
	}

	p := &Instance{module: module, gate: make(chan struct{}, 1), artifact: r.artifact}

	if _, err := p.call(ctx, operation, config); err != nil {
		p.Close(context.Background())
		return nil, err
	}

	return p, nil
}

// Close releases only this instance, leaving its Runtime usable.
func (p *Instance) Close(ctx context.Context) error { return p.module.Close(ctx) }

// Call invokes a Markdown ABI operation and copies its JSON result before unlocking.
func (p *Instance) Call(ctx context.Context, operation, source string, args ...uint64) (json.RawMessage, error) {
	select {
	case p.gate <- struct{}{}:
		defer func() { <-p.gate }()

	case <-ctx.Done():
		return nil, ctx.Err()
	}

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	return p.call(ctx, operation, source, args...)
}

func (p *Instance) call(ctx context.Context, operation, input string, args ...uint64) (json.RawMessage, error) {
	if p.module.IsClosed() {
		return nil, fmt.Errorf("parser is closed")
	}

	if err := p.writeInput(ctx, input); err != nil {
		return nil, err
	}

	length, err := p.run(ctx, operation, args...)
	if err != nil {
		return nil, err
	}

	output, err := p.readOutput(ctx, length)
	if err != nil {
		return nil, err
	}

	return decodeReply(output, operation, p.artifact.BuildID)
}

func (p *Instance) writeInput(ctx context.Context, input string) error {
	if len(input) > p.artifact.InputBytes {
		return fmt.Errorf("Wasm input limit exceeded")
	}

	pointer, err := p.module.ExportedFunction("input_ptr").Call(ctx, uint64(len(input)))
	if err != nil {
		return err
	}
	if pointer[0] == 0 {
		return fmt.Errorf("Wasm input limit exceeded")
	}
	if !p.module.Memory().Write(uint32(pointer[0]), []byte(input)) {
		return fmt.Errorf("invalid Wasm input range")
	}

	return nil
}

func (p *Instance) run(ctx context.Context, operation string, args ...uint64) (uint64, error) {
	function := p.module.ExportedFunction(operation)
	if function == nil {
		return 0, fmt.Errorf("unsupported Wasm operation: %s", operation)
	}

	result, err := function.Call(ctx, args...)
	if err != nil {
		if ctx.Err() != nil {
			return 0, ctx.Err()
		}
		return 0, err
	}

	return result[0], nil
}

func (p *Instance) readOutput(ctx context.Context, length uint64) ([]byte, error) {
	pointer, err := p.module.ExportedFunction("output_ptr").Call(ctx)
	if err != nil {
		return nil, err
	}

	output, ok := p.module.Memory().Read(uint32(pointer[0]), uint32(length))
	if !ok {
		return nil, fmt.Errorf("invalid Wasm output range")
	}

	return output, nil
}

func decodeReply(output []byte, operation, buildID string) (json.RawMessage, error) {
	var reply struct {
		Document   json.RawMessage `json:"document"`
		Result     json.RawMessage `json:"result"`
		Error      json.RawMessage `json:"error"`
		Configured string          `json:"configured"`
	}

	if err := json.Unmarshal(output, &reply); err != nil {
		return nil, err
	}

	if reply.Error != nil {
		return nil, fmt.Errorf("markdown: %s", reply.Error)
	}

	if strings.HasPrefix(operation, "configure") && reply.Configured != buildID {
		return nil, fmt.Errorf("Wasm does not match this SDK build")
	}

	if reply.Document != nil {
		return reply.Document, nil
	}

	return reply.Result, nil
}
