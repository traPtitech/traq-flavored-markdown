package worker

import (
	"bufio"
	"fmt"
	"io"
	"sort"
	"time"
)

type Adapter func(source string) (string, error)
type Input func() (io.ReadCloser, error)
type Options struct {
	RunID   string
	Max     int
	Warmups int
	Before  Adapter
	After   Adapter
	Now     func() time.Time
}

func summarize(values []float64) Timing {
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	var total float64
	for _, value := range sorted {
		total += value
	}
	if len(sorted) == 0 {
		return Timing{}
	}
	percentile := func(p float64) float64 { return sorted[int(float64(len(sorted)-1)*p)] * 1000 }
	return Timing{Calls: len(sorted), TotalMS: total, MeanUS: total / float64(len(sorted)) * 1000, P50US: percentile(.5), P95US: percentile(.95), P99US: percentile(.99)}
}

func measure(adapter Adapter, source string, now func() time.Time) (outcome Outcome, elapsed float64) {
	started := now()
	defer func() {
		elapsed = float64(now().Sub(started).Nanoseconds()) / 1e6
		if failure := recover(); failure != nil {
			outcome = Outcome{Kind: "error", Value: fmt.Sprint(failure)}
		}
	}()
	value, err := adapter(source)
	if err != nil {
		return Outcome{Kind: "error", Value: err.Error()}, 0
	}
	return Outcome{Kind: "text", Value: value}, 0
}

func sources(input Input, visit func(SourceRecord) (bool, error)) (err error) {
	reader, err := input()
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := reader.Close(); err == nil {
			err = closeErr
		}
	}()
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 65536), 16<<20)
	for scanner.Scan() {
		if len(scanner.Bytes()) == 0 {
			continue
		}
		var source SourceRecord
		if err := decode("source", scanner.Bytes(), &source); err != nil {
			return err
		}
		more, err := visit(source)
		if err != nil || !more {
			return err
		}
	}
	return scanner.Err()
}

// Compare measures Go adapters in-process; corpus parsing and sinks are excluded.
func Compare(input Input, options Options, difference func(DifferenceRow) error) (ProfileResult, error) {
	result := ProfileResult{}
	if options.RunID == "" || options.Max <= 0 || options.Warmups < 0 || options.Before == nil || options.After == nil {
		return result, fmt.Errorf("invalid comparison options")
	}
	if options.Now == nil {
		options.Now = time.Now
	}
	if options.Warmups > 0 {
		err := sources(input, func(source SourceRecord) (bool, error) {
			measure(options.Before, source.Source, options.Now)
			measure(options.After, source.Source, options.Now)
			result.ActualWarmups++
			return result.ActualWarmups < options.Warmups, nil
		})
		if err != nil {
			return result, err
		}
	}
	beforeTimes, afterTimes := []float64{}, []float64{}
	err := sources(input, func(source SourceRecord) (bool, error) {
		if result.Messages >= options.Max {
			return false, nil
		}
		var before, after Outcome
		var beforeMS, afterMS float64
		if result.Messages%2 == 0 {
			before, beforeMS = measure(options.Before, source.Source, options.Now)
			after, afterMS = measure(options.After, source.Source, options.Now)
		} else {
			after, afterMS = measure(options.After, source.Source, options.Now)
			before, beforeMS = measure(options.Before, source.Source, options.Now)
		}
		beforeTimes = append(beforeTimes, beforeMS)
		afterTimes = append(afterTimes, afterMS)
		if before.Kind == "error" {
			result.BeforeErrors++
		}
		if after.Kind == "error" {
			result.AfterErrors++
		}
		if before != after {
			result.Differences++
			if err := difference(DifferenceRow{RunID: options.RunID, Index: result.Messages, Profile: "plainText", Source: source.Source, Before: before, After: after}); err != nil {
				return false, err
			}
		}
		result.Messages++
		return result.Messages < options.Max, nil
	})
	result.Before, result.After = summarize(beforeTimes), summarize(afterTimes)
	return result, err
}
