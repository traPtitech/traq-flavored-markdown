package markdown

import "testing"

func TestWireDiagnosticsUseGeneratedSchema(t *testing.T) {
	result, err := decodeWireError([]byte(`{"code":"internal_error","message":"invalid output","phase":"inline","rule":"custom","offset":0,"path":"$.children[0]","span":{"start":0,"end":1},"payloadType":"example.Text"}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Phase != "inline" || result.Rule != "custom" || result.PayloadType != "example.Text" || result.Offset == nil || *result.Offset != 0 || result.Span == nil || result.Span.End != 1 {
		t.Fatalf("lost diagnostic: %#v", result)
	}
	for _, raw := range []string{
		`{"code":"unknown","message":"bad"}`,
		`{"code":"internal_error","message":"bad","phase":"unknown"}`,
		`{"code":"internal_error","message":"bad","offset":4294967296}`,
		`{"code":"internal_error","message":"bad","span":{"start":0}}`,
		`{"code":"internal_error","message":"bad","extra":true}`,
		`{"code":"internal_error","message":"bad","rule":"\ud800"}`,
	} {
		if _, err := decodeWireError([]byte(raw)); err == nil {
			t.Fatalf("accepted malformed diagnostic: %s", raw)
		}
	}
	if _, err := decodeWireError([]byte(`{"code":"internal_error","message":"bad","rule":null,"span":null,"offset":null}`)); err != nil {
		t.Fatalf("rejected schema-permitted null diagnostics: %v", err)
	}
}
