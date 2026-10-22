package main

import (
	"bufio"
	"context"
	before "corpuscomparison/go-before"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	markdown "github.com/traPtitech/traq-flavored-markdown/packages/sdk/go"
)

type record struct {
	Source string `json:"source"`
}
type difference struct {
	Index      int    `json:"index"`
	Mode       string `json:"mode"`
	Source     string `json:"source"`
	Before     string `json:"before"`
	After      string `json:"after"`
	BeforeType string `json:"beforeType"`
	AfterType  string `json:"afterType"`
	Error      bool   `json:"error,omitempty"`
}
type timing struct {
	Calls   int     `json:"calls"`
	TotalMs float64 `json:"totalMs"`
	MeanUs  float64 `json:"meanUs"`
	P50Us   float64 `json:"p50Us"`
	P95Us   float64 `json:"p95Us"`
	P99Us   float64 `json:"p99Us"`
}
type comparisonPlan struct {
	Format  int    `json:"format"`
	Corpus  string `json:"corpus"`
	Output  string `json:"output"`
	Origin  string `json:"origin"`
	Wasm    string `json:"wasm"`
	Max     int    `json:"max"`
	Warmups int    `json:"warmups"`
}
type initialization struct {
	BeforeMs float64 `json:"beforeMs"`
	AfterMs  float64 `json:"afterMs"`
}
type comparisonResult struct {
	Messages             int            `json:"messages"`
	Differences          int            `json:"differences"`
	EmbeddingDifferences int            `json:"embeddingDifferences"`
	BeforeErrors         int            `json:"beforeErrors"`
	AfterErrors          int            `json:"afterErrors"`
	Before               timing         `json:"before"`
	After                timing         `json:"after"`
	Initialization       initialization `json:"initialization"`
}

func summarize(values []int64) timing {
	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
	var total int64
	for _, v := range values {
		total += v
	}
	if len(values) == 0 {
		return timing{}
	}
	q := func(p float64) float64 { return float64(values[int(float64(len(values)-1)*p)]) / 1000 }
	return timing{len(values), float64(total) / 1e6, float64(total) / float64(len(values)) / 1000, q(.5), q(.95), q(.99)}
}
func run(f func() (string, error)) (value string, elapsed int64, failed bool) {
	start := time.Now()
	defer func() {
		elapsed = time.Since(start).Nanoseconds()
		if recover() != nil {
			value = "実行エラー"
			failed = true
		}
	}()
	value, err := f()
	if err != nil {
		value = "解析エラー: " + err.Error()
		failed = true
	}
	return
}
func main() {
	planPath := flag.String("plan", "", "comparison plan JSON")
	flag.Parse()
	var plan comparisonPlan
	data, err := os.ReadFile(*planPath)
	must(err)
	must(json.Unmarshal(data, &plan))
	if plan.Format != 1 || plan.Max < 1 || plan.Warmups < 0 || plan.Corpus == "" || plan.Output == "" || plan.Wasm == "" {
		panic("invalid comparison plan")
	}
	beforeInitStart := time.Now()
	before.SetOrigin(plan.Origin)
	beforeInitMs := float64(time.Since(beforeInitStart).Nanoseconds()) / 1e6
	wasm, err := os.ReadFile(plan.Wasm)
	must(err)
	initStart := time.Now()
	runtime, err := markdown.NewRuntime(context.Background(), wasm)
	must(err)
	defer runtime.Close(context.Background())
	parser, err := runtime.NewParser(context.Background(), markdown.PresetTraqV1)
	must(err)
	renderer, err := runtime.NewPlainTextRenderer(context.Background(), markdown.RendererOptions{Origin: plan.Origin})
	must(err)
	initMs := float64(time.Since(initStart).Nanoseconds()) / 1e6
	input, err := os.Open(plan.Corpus)
	must(err)
	defer input.Close()
	must(os.MkdirAll(plan.Output, 0700))
	output, err := os.Create(filepath.Join(plan.Output, "plain-text-differences.jsonl"))
	must(err)
	defer output.Close()
	writer := bufio.NewWriterSize(output, 1<<20)
	defer writer.Flush()
	encoder := json.NewEncoder(writer)
	encoder.SetEscapeHTML(false)
	old := func(s string) (string, error) { return before.Parse(s).NotificationText(), nil }
	current := func(s string) (string, error) {
		doc, e := parser.Parse(context.Background(), s)
		if e != nil {
			return "", e
		}
		return renderer.Render(context.Background(), doc)
	}
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 65536), 16<<20)
	for n := 0; n < plan.Warmups && scanner.Scan(); n++ {
		var r record
		must(json.Unmarshal(scanner.Bytes(), &r))
		run(func() (string, error) { return old(r.Source) })
		run(func() (string, error) { return current(r.Source) })
	}
	must(scanner.Err())
	_, err = input.Seek(0, 0)
	must(err)
	scanner = bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 65536), 16<<20)
	count, different, oldErrors, newErrors := 0, 0, 0, 0
	oldTimes, newTimes := make([]int64, 0, 100000), make([]int64, 0, 100000)
	for scanner.Scan() {
		if count >= plan.Max {
			break
		}
		var r record
		must(json.Unmarshal(scanner.Bytes(), &r))
		var a, b string
		var at, bt int64
		var ae, be bool
		oldCall := func() { a, at, ae = run(func() (string, error) { return old(r.Source) }) }
		newCall := func() { b, bt, be = run(func() (string, error) { return current(r.Source) }) }
		if count%2 == 0 {
			oldCall()
			newCall()
		} else {
			newCall()
			oldCall()
		}
		oldTimes = append(oldTimes, at)
		newTimes = append(newTimes, bt)
		if ae {
			oldErrors++
		}
		if be {
			newErrors++
		}
		if a != b || ae != be {
			different++
			beforeType, afterType := "text", "text"
			if ae {
				beforeType = "error"
			}
			if be {
				afterType = "error"
			}
			must(encoder.Encode(difference{count, "plainText", r.Source, a, b, beforeType, afterType, ae || be}))
		}
		count++
		if count%100000 == 0 {
			must(writer.Flush())
			fmt.Printf("{\"processed\":%d,\"differences\":%d}\n", count, different)
		}
	}
	must(scanner.Err())
	must(writer.Flush())
	report := map[string]comparisonResult{"plainText": {
		Messages: count, Differences: different, BeforeErrors: oldErrors, AfterErrors: newErrors,
		Before: summarize(oldTimes), After: summarize(newTimes), Initialization: initialization{BeforeMs: beforeInitMs, AfterMs: initMs},
	}}
	data, err = json.MarshalIndent(report, "", "  ")
	must(err)
	must(os.WriteFile(filepath.Join(plan.Output, "plain-text-results.json"), data, 0600))
	fmt.Println(string(data))
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
