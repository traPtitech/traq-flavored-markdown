package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	markdown "github.com/uni-kakurenbo/traq-markdown-engine/packages/sdk/go"
)

func main() {
	wasmPath := flag.String("wasm", "", "optional path to a matching Wasm artifact")
	flag.Parse()
	if err := run(*wasmPath); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(path string) error {
	ctx := context.Background()
	var runtime *markdown.Runtime
	var err error
	if path == "" {
		runtime, err = markdown.NewBundledRuntime(ctx)
	} else {
		var wasm []byte
		wasm, err = os.ReadFile(path)
		if err != nil {
			return err
		}
		runtime, err = markdown.NewRuntime(ctx, wasm)
	}
	if err != nil {
		return err
	}
	defer runtime.Close(ctx)

	parser, err := runtime.NewParser(ctx, markdown.PresetTraQV1)
	if err != nil {
		return err
	}
	defer parser.Close(ctx)

	document, err := parser.Parse(ctx, "**hello** :stamp: $x$")
	if err != nil {
		return err
	}

	raw, err := json.Marshal(document)
	if err != nil {
		return err
	}

	fmt.Println(string(raw))

	extractor, err := runtime.NewExtractor(
		ctx,
		markdown.ExtractorOptions{Origin: "https://q.example.test"},
	)
	if err != nil {
		return err
	}
	defer extractor.Close(ctx)

	result, err := extractor.Extract(ctx, document)
	if err != nil {
		return err
	}

	raw, err = json.Marshal(result)
	if err != nil {
		return err
	}
	fmt.Println(string(raw))

	renderer, err := runtime.NewPlainTextRenderer(ctx, markdown.RendererOptions{Origin: "https://q.example.test"})
	if err != nil {
		return err
	}
	defer renderer.Close(ctx)

	text, err := renderer.Render(ctx, document)
	if err != nil {
		return err
	}

	fmt.Println(text)

	return nil
}
