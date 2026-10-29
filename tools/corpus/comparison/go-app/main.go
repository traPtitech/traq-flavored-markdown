package main

import (
	"context"
	before "corpuscomparison/go-before"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	markdown "github.com/traPtitech/traq-flavored-markdown/packages/sdk/go"
	worker "github.com/traPtitech/traq-flavored-markdown/tools/corpus/comparison/go"
)

func main() {
	if err := compare(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func compare() error {
	planPath := flag.String("plan", "", "comparison plan JSON")
	flag.Parse()
	data, err := os.ReadFile(*planPath)
	if err != nil {
		return err
	}
	plan, err := worker.ParsePlan(data)
	if err != nil {
		return err
	}
	if _, compared := plan.Provenance.Before["plainText"]; !compared {
		return fmt.Errorf("plain-text comparison is not selected")
	}
	started := time.Now()
	before.SetOrigin(plan.Origin)
	beforeMS := float64(time.Since(started).Nanoseconds()) / 1e6
	bytes, err := os.ReadFile(plan.Wasm)
	if err != nil {
		return err
	}
	started = time.Now()
	ctx := context.Background()
	runtime, err := markdown.NewRuntime(ctx, bytes)
	if err != nil {
		return err
	}
	defer runtime.Close(ctx)
	parser, err := runtime.NewParser(ctx, markdown.GrammarTraqV1)
	if err != nil {
		return err
	}
	renderer, err := runtime.NewPlainTextRenderer(ctx, markdown.PlainTextOptions{Origin: plan.Origin})
	if err != nil {
		return err
	}
	initialization := worker.Initialization{BeforeMS: beforeMS, AfterMS: float64(time.Since(started).Nanoseconds()) / 1e6}
	baseline := func(source string) (string, error) { return before.Parse(source).NotificationText(), nil }
	candidate := func(source string) (string, error) {
		document, err := parser.Parse(ctx, source)
		if err != nil {
			return "", err
		}
		return renderer.Render(ctx, document)
	}
	result, err := worker.RunFiles(plan, baseline, candidate, initialization)
	if err != nil {
		return err
	}
	return json.NewEncoder(os.Stdout).Encode(result)
}
