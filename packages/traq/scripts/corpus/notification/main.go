package main

import (
	"bufio"
	"context"
	before "corpuscomparison/go-before"
	"encoding/json"
	"flag"
	"fmt"
	markdown "github.com/traq-markdown-parser/traq/go"
	"os"
	"path/filepath"
	"sort"
	"time"
)

type record struct {
	Source string `json:"source"`
}
type difference struct {
	Index  int    `json:"index"`
	Mode   string `json:"mode"`
	Source string `json:"source"`
	Before string `json:"before"`
	After  string `json:"after"`
	Error  bool   `json:"error,omitempty"`
}
type timing struct {
	Calls   int     `json:"calls"`
	TotalMs float64 `json:"totalMs"`
	MeanUs  float64 `json:"meanUs"`
	P50Us   float64 `json:"p50Us"`
	P95Us   float64 `json:"p95Us"`
	P99Us   float64 `json:"p99Us"`
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
	corpus := flag.String("corpus", "", "corpus JSONL")
	out := flag.String("out", "", "output directory")
	config := flag.String("config", "", "local config JSON")
	max := flag.Int("max", 100000, "message limit")
	flag.Parse()
	var conf struct {
		Origin string `json:"origin"`
		Wasm   string `json:"wasm"`
	}
	data, err := os.ReadFile(*config)
	must(err)
	must(json.Unmarshal(data, &conf))
	before.SetOrigin(conf.Origin)
	initStart := time.Now()
	wasm, err := os.ReadFile(conf.Wasm)
	must(err)
	runtime, err := markdown.NewRuntime(context.Background(), wasm)
	must(err)
	defer runtime.Close(context.Background())
	parser, err := runtime.NewParser(context.Background(), markdown.PresetTraQV1)
	must(err)
	renderer, err := runtime.NewPlainTextRenderer(context.Background(), markdown.RendererOptions{Origin: conf.Origin})
	must(err)
	initMs := float64(time.Since(initStart).Nanoseconds()) / 1e6
	input, err := os.Open(*corpus)
	must(err)
	defer input.Close()
	must(os.MkdirAll(*out, 0700))
	output, err := os.Create(filepath.Join(*out, "traq-differences.jsonl"))
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
	for n := 0; n < 200 && scanner.Scan(); n++ {
		var r record
		must(json.Unmarshal(scanner.Bytes(), &r))
		old(r.Source)
		current(r.Source)
	}
	must(scanner.Err())
	_, err = input.Seek(0, 0)
	must(err)
	scanner = bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 65536), 16<<20)
	count, different, oldErrors, newErrors := 0, 0, 0, 0
	oldTimes, newTimes := make([]int64, 0, 100000), make([]int64, 0, 100000)
	started := time.Now()
	for scanner.Scan() {
		if *max > 0 && count >= *max {
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
			must(encoder.Encode(difference{count, "notification", r.Source, a, b, ae || be}))
		}
		count++
		if count%100000 == 0 {
			must(writer.Flush())
			fmt.Printf("{\"processed\":%d,\"differences\":%d}\n", count, different)
		}
	}
	must(scanner.Err())
	must(writer.Flush())
	report := map[string]any{"messages": count, "differences": different, "beforeErrors": oldErrors, "afterErrors": newErrors, "before": summarize(oldTimes), "after": summarize(newTimes), "afterInitializationMs": initMs, "wallSeconds": time.Since(started).Seconds(), "timed": "Parse().NotificationText() / Rust Parser.Parse() + PlainTextRenderer.Render(document); 200 warmups; alternating order; I/O excluded"}
	data, err = json.MarshalIndent(report, "", "  ")
	must(err)
	must(os.WriteFile(filepath.Join(*out, "traq-summary.json"), data, 0600))
	fmt.Println(string(data))
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
