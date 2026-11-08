package binding

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
)

func TestHostErrorsRetainCausesAndOperations(t *testing.T) {
	cause := &ast.ValidationError{Path: "$.children", Message: "invalid children", Resource: "nodes"}
	wrapped := WithOperation(DocumentError(cause), "extract")
	var validation *ast.ValidationError
	var detail *Error

	if !errors.Is(wrapped, cause) || !errors.As(wrapped, &validation) || !errors.As(wrapped, &detail) || detail.Operation != "extract" || detail.Code != "resource_limit" {
		t.Fatal(wrapped)
	}

	changed := WithOperation(wrapped, "render")
	if detail.Operation != "extract" || !errors.Is(changed, wrapped) {
		t.Fatal("operation annotation mutated its cause")
	}

	raw, err := json.Marshal(detail)
	if err != nil {
		t.Fatal(err)
	}

	var fields map[string]any
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}

	if fields["Operation"] != nil || fields["Cause"] != nil {
		t.Fatal("host context escaped to wire JSON")
	}
}

func TestCanceledConstructionAndCallsShareErrorContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, compile := NewRuntime(ctx, nil, Artifact{})
	runtime := &Runtime{}
	_, configure := runtime.NewInstance(ctx, Operation{Export: "configure"}, "")
	instance := &Instance{gate: make(chan struct{}, 1)}
	_, call := instance.Call(ctx, Operation{Export: "parse"}, "")

	for operation, err := range map[string]error{"compile": compile, "configure": configure, "parse": call} {
		var detail *Error
		if !errors.Is(err, context.Canceled) || !errors.As(err, &detail) || detail.Operation != operation {
			t.Fatalf("%s: %v", operation, err)
		}
	}
}
