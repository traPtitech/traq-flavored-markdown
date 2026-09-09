// Code generated from Rust contract ownership. DO NOT EDIT.
package markdown

import (
	commonmark "github.com/traq-markdown-parser/commonmark/go"
	generic "github.com/traq-markdown-parser/commonmark/go/generic"
	"github.com/traq-markdown-parser/core/go/ast"
	trap "github.com/traq-markdown-parser/trap-extension/go"
)

type Document = ast.Document
type Node = ast.Node
type Span = ast.Span
type Payload = ast.Payload

func DecodeDocument(raw []byte) (*Document, error) { return ast.DecodeDocument(raw, newPayload) }
func newPayload(kind string) ast.Payload {
	if value := commonmark.NewPayload(kind); value != nil {
		return value
	}
	if value := generic.NewPayload(kind); value != nil {
		return value
	}
	if value := trap.NewPayload(kind); value != nil {
		return value
	}
	return nil
}
