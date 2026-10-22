package binding

import (
	"context"
	"errors"
	"testing"
)

// A tiny real Wasm module isolates transport faults from parser behavior. It
// configures correctly, then either traps or returns a truncated JSON response.
func faultyModule(trap bool) []byte {
	module := []byte{0, 97, 115, 109, 1, 0, 0, 0}
	leb := func(value int) []byte {
		var result []byte
		for {
			b := byte(value & 127)
			value >>= 7
			if value != 0 {
				b |= 128
			}
			result = append(result, b)
			if value == 0 {
				return result
			}
		}
	}
	section := func(id byte, data []byte) {
		module = append(module, id)
		module = append(module, leb(len(data))...)
		module = append(module, data...)
	}
	section(1, []byte{2, 0x60, 0, 1, 0x7f, 0x60, 1, 0x7f, 1, 0x7f})
	section(3, []byte{4, 1, 0, 0, 1})
	section(5, []byte{1, 0, 1})
	exports := []byte{5}
	for index, name := range []string{"input_ptr", "output_ptr", "configure", "parse", "memory"} {
		exports = append(exports, byte(len(name)))
		exports = append(exports, name...)
		kind := byte(0)
		if name == "memory" {
			kind = 2
			index = 0
		}
		exports = append(exports, kind, byte(index))
	}
	section(7, exports)
	reply := []byte(`{"ok":{"contractId":"test"}}`)
	parse := []byte{0, 0x41, 1, 0x0b}
	if trap {
		parse = []byte{0, 0x00, 0x0b}
	}
	code := []byte{4}
	for _, body := range [][]byte{{0, 0x41, 0x80, 0x08, 0x0b}, {0, 0x41, 0, 0x0b}, {0, 0x41, byte(len(reply)), 0x0b}, parse} {
		code = append(code, byte(len(body)))
		code = append(code, body...)
	}
	section(10, code)
	data := []byte{1, 0, 0x41, 0, 0x0b, byte(len(reply))}
	data = append(data, reply...)
	section(11, data)
	return module
}

func transportArtifact() Artifact {
	return Artifact{ContractID: "test", InputBytes: 1024, OutputBytes: 1024, MemoryPages: 1, Exports: map[string]Signature{
		"input_ptr":  {Params: []string{"i32"}, Results: []string{"i32"}},
		"output_ptr": {Results: []string{"i32"}},
		"configure":  {Results: []string{"i32"}},
		"parse":      {Params: []string{"i32"}, Results: []string{"i32"}},
	}}
}

func TestTransportFailureClosesInstance(t *testing.T) {
	for _, trap := range []bool{false, true} {
		ctx := context.Background()
		runtime, err := NewRuntime(ctx, faultyModule(trap), transportArtifact())
		if err != nil {
			t.Fatal(err)
		}
		instance, err := runtime.NewInstance(ctx, Operation{Export: "configure", Configuration: true}, "preset")
		if err != nil {
			t.Fatal(err)
		}
		parse := Operation{Export: "parse", Params: []string{"i32"}, Result: "document"}
		_, err = instance.Call(ctx, parse, "x", 0)
		var typed *Error
		if !errors.As(err, &typed) || typed.Code != "transport_error" {
			t.Fatalf("trap=%v: %v", trap, err)
		}
		_, err = instance.Call(ctx, parse, "x", 0)
		if !errors.As(err, &typed) || typed.Code != "disposed" {
			t.Fatalf("instance survived transport failure: %v", err)
		}
		runtime.Close(ctx)
	}
}

func TestRuntimeChecksEveryGeneratedSignature(t *testing.T) {
	artifact := transportArtifact()
	artifact.Exports["parse"] = Signature{Results: []string{"i32"}}
	_, err := NewRuntime(context.Background(), faultyModule(false), artifact)
	var typed *Error
	if !errors.As(err, &typed) || typed.Code != "contract_mismatch" {
		t.Fatal(err)
	}
}
