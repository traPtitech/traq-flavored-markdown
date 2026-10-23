package binding

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func TestCanceledWaitDoesNotTakeInstance(t *testing.T) {
	instance := &Instance{gate: make(chan struct{}, 1)}
	instance.gate <- struct{}{}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)

	go func() { _, err := instance.Call(ctx, Operation{Export: "parse"}, "waiting"); done <- err }()
	cancel()

	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}

	if len(instance.gate) != 1 {
		t.Fatal("canceled waiter changed the instance gate")
	}
}

func TestRendererConfigurationChecksContractIdentity(t *testing.T) {
	operation := Operation{Export: "configure_renderer", Configuration: true}
	if _, err := decodeReply([]byte(`{"ok":{"contractId":"another-contract"}}`), operation, "expected-contract", nil); err == nil {
		t.Fatal("accepted a renderer from another build")
	}

	if _, err := decodeReply([]byte(`{"ok":{"contractId":"expected-contract"}}`), operation, "expected-contract", nil); err != nil {
		t.Fatal(err)
	}
}

func TestRepliesHaveOneTypedOutcome(t *testing.T) {
	for _, raw := range []string{`{}`, `null`, `{"ok":null}`, `{"result":1}`, `{"ok":"x","error":{"code":"invalid_request","message":"bad"}}`, `{"error":"bad"}`, `{"error":{"code":"unknown","message":"bad"}}`, `{"ok":"\ud800"}`} {
		_, err := decodeReply([]byte(raw), Operation{}, "id", nil)
		var typed *Error
		if !errors.As(err, &typed) || typed.Code != "transport_error" {
			t.Fatalf("%s: %v", raw, err)
		}
	}
	_, err := decodeReply([]byte(`{"error":{"code":"invalid_document","message":"bad span","path":"$.children[0]","span":{"start":0,"end":1}}}`), Operation{}, "id", func(raw json.RawMessage) (*Error, error) {
		var value Error
		err := json.Unmarshal(raw, &value)
		return &value, err
	})
	var typed *Error
	if !errors.As(err, &typed) || typed.Code != "invalid_document" || typed.Path != "$.children[0]" || typed.Span == nil {
		t.Fatal(err)
	}
}
