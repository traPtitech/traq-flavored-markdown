package markdown

import (
	"context"
	_ "embed"
)

// bundledWasm is synchronized with the SDK build before each release.
//
//go:embed parser.wasm
var bundledWasm []byte

// NewBundledRuntime creates a runtime from the Wasm shipped with this Go module.
func NewBundledRuntime(ctx context.Context) (*Runtime, error) {
	return NewRuntime(ctx, bundledWasm)
}
