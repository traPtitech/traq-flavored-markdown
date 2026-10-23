package worker

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestSharedMeasurement(t *testing.T) {
	data, err := os.ReadFile("../../testing/measurement.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Warmups     int
		Max         int
		Sources     []string
		Before      map[string]string
		After       map[string]string
		Errors      []string
		Order       []string
		Differences []DifferenceRow
	}
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	var source strings.Builder
	for _, text := range fixture.Sources {
		row, _ := json.Marshal(SourceRecord{Source: text})
		source.Write(row)
		source.WriteByte('\n')
	}
	order, differences := []string{}, []DifferenceRow{}
	result, err := Compare(func() (io.ReadCloser, error) { return io.NopCloser(strings.NewReader(source.String())), nil }, Options{RunID: "shared-fixture", Max: fixture.Max, Warmups: fixture.Warmups,
		Before: func(source string) (string, error) {
			order = append(order, "before:"+source)
			return fixture.Before[source], nil
		},
		After: func(source string) (string, error) {
			order = append(order, "after:"+source)
			for _, failed := range fixture.Errors {
				if failed == source {
					return "", errors.New(fixture.After[source])
				}
			}
			return fixture.After[source], nil
		},
	}, func(row DifferenceRow) error { differences = append(differences, row); return nil })
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(order, fixture.Order) {
		t.Errorf("order: %v", order)
	}
	if !reflect.DeepEqual(differences, fixture.Differences) {
		t.Errorf("differences: %v", differences)
	}
	if result.Messages != 3 || result.ActualWarmups != 1 || result.AfterErrors != 1 {
		t.Errorf("counts: %+v", result)
	}
}

func TestInputAndTiming(t *testing.T) {
	if got := summarize([]float64{4, 1, 3, 2}); got != (Timing{Calls: 4, TotalMS: 10, MeanUS: 2500, P50US: 2000, P95US: 3000, P99US: 3000}) {
		t.Errorf("timing: %+v", got)
	}
	count := 0
	if err := sources(func() (io.ReadCloser, error) {
		return io.NopCloser(strings.NewReader("\r\n{\"source\":\"a\"}\r\n\n{\"source\":\"b\"}")), nil
	}, func(SourceRecord) (bool, error) { count++; return true, nil }); err != nil || count != 2 {
		t.Errorf("JSONL: %d %v", count, err)
	}
	for _, text := range []string{"{}", "{\"source\":null}", "null"} {
		if err := sources(func() (io.ReadCloser, error) { return io.NopCloser(strings.NewReader(text)), nil }, func(SourceRecord) (bool, error) { return true, nil }); err == nil {
			t.Errorf("accepted invalid source %s", text)
		}
	}
}
