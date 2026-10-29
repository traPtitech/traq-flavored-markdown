// Code generated from the Rust ABI contract. DO NOT EDIT.
package markdown

import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
import "github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"

const contractID = "7b5d51e2bd2f0dd5ed21b2237489c6d456e8c4fe0f746c0f50d00d3e3ff991e8"
const sourceFingerprint = "9a0f4e11178eb051"
const inputBytes = 1048576
const outputBytes = 1048576
const memoryPages = 512

var documentLimits = ast.Limits{SourceBytes: 65536, PayloadBytes: 8388608, Nodes: 16384, Depth: 64}
var operationConfigure = binding.Operation{Export: "configure", Input: "text", Params: []string{}, Result: "configuration", Configuration: true}
var operationConfigureExtractor = binding.Operation{Export: "configure_extractor", Input: "json", Params: []string{}, Result: "configuration", Configuration: true}
var operationConfigureProcessor = binding.Operation{Export: "configure_processor", Input: "json", Params: []string{}, Result: "configuration", Configuration: true}
var operationConfigureRenderer = binding.Operation{Export: "configure_renderer", Input: "json", Params: []string{}, Result: "configuration", Configuration: true}
var operationExtract = binding.Operation{Export: "extract", Input: "json", Params: []string{}, Result: "extraction", Configuration: false}
var operationParse = binding.Operation{Export: "parse", Input: "text", Params: []string{"i32"}, Result: "document", Configuration: false}
var operationProcess = binding.Operation{Export: "process", Input: "text", Params: []string{"i32"}, Result: "processing", Configuration: false}
var operationRender = binding.Operation{Export: "render", Input: "json", Params: []string{}, Result: "text", Configuration: false}
var abiExports = map[string]binding.Signature{
	"configure":           {Params: []string{}, Results: []string{"i32"}},
	"configure_extractor": {Params: []string{}, Results: []string{"i32"}},
	"configure_processor": {Params: []string{}, Results: []string{"i32"}},
	"configure_renderer":  {Params: []string{}, Results: []string{"i32"}},
	"contract_len":        {Params: []string{}, Results: []string{"i32"}},
	"contract_ptr":        {Params: []string{}, Results: []string{"i32"}},
	"extract":             {Params: []string{}, Results: []string{"i32"}},
	"input_ptr":           {Params: []string{"i32"}, Results: []string{"i32"}},
	"output_ptr":          {Params: []string{}, Results: []string{"i32"}},
	"parse":               {Params: []string{"i32"}, Results: []string{"i32"}},
	"process":             {Params: []string{"i32"}, Results: []string{"i32"}},
	"render":              {Params: []string{}, Results: []string{"i32"}},
}
