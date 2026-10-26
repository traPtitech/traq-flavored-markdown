package worker

import (
	"encoding/json"
	"os"
	"testing"
)

func TestSharedProtocolCases(t *testing.T) {
	data, err := os.ReadFile("../../protocol/cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Schema string
		Valid  bool
		JSON   string
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, item := range cases {
		var err error
		if item.Schema == "difference" {
			var row DifferenceRow
			err = decode(item.Schema, []byte(item.JSON), &row)
		} else {
			var source SourceRecord
			err = decode(item.Schema, []byte(item.JSON), &source)
		}
		if (err == nil) != item.Valid {
			t.Errorf("%s: accepted=%v, want=%v (%v)", item.JSON, err == nil, item.Valid, err)
		}
	}
}
