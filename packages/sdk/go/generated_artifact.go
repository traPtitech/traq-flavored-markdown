// Code generated from the Rust ABI contract. DO NOT EDIT.
package markdown

import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"

const contractID = "c01dcf2ea189a2ccde547658b77203e0d4ade5cc2d2e0c923c047e522e6dfaf7"
const sourceFingerprint = "bbdef4943e2a494e"
const inputBytes = 1048576
const outputBytes = 1048576
const memoryPages = 512

var documentLimits = ast.Limits{SourceBytes: 65536, PayloadBytes: 8388608, Nodes: 16384, Depth: 64}
var wireErrorCodes = map[string]bool{"invalid_utf8": true, "invalid_request": true, "invalid_document": true, "unknown_preset": true, "invalid_mode": true, "not_configured": true, "resource_limit": true, "internal_error": true}
var operationConfigure = binding.Operation{Export: "configure", Input: "text", Params: []string{}, Result: "configuration", Configuration: true}
var operationConfigureExtractor = binding.Operation{Export: "configure_extractor", Input: "json", Params: []string{}, Result: "configuration", Configuration: true}
var operationConfigureRenderer = binding.Operation{Export: "configure_renderer", Input: "json", Params: []string{}, Result: "configuration", Configuration: true}
var operationExtract = binding.Operation{Export: "extract", Input: "json", Params: []string{}, Result: "extraction", Configuration: false}
var operationParse = binding.Operation{Export: "parse", Input: "text", Params: []string{"i32"}, Result: "document", Configuration: false}
var operationRender = binding.Operation{Export: "render", Input: "json", Params: []string{}, Result: "text", Configuration: false}
var abiExports = map[string]binding.Signature{
	"configure":           {Params: []string{}, Results: []string{"i32"}},
	"configure_extractor": {Params: []string{}, Results: []string{"i32"}},
	"configure_renderer":  {Params: []string{}, Results: []string{"i32"}},
	"contract_len":        {Params: []string{}, Results: []string{"i32"}},
	"contract_ptr":        {Params: []string{}, Results: []string{"i32"}},
	"extract":             {Params: []string{}, Results: []string{"i32"}},
	"input_ptr":           {Params: []string{"i32"}, Results: []string{"i32"}},
	"output_ptr":          {Params: []string{}, Results: []string{"i32"}},
	"parse":               {Params: []string{"i32"}, Results: []string{"i32"}},
	"render":              {Params: []string{}, Results: []string{"i32"}},
}
