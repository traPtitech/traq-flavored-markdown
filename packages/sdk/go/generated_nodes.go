// Code generated from Rust contract ownership. DO NOT EDIT.
package markdown

import (
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	commonmark "github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go"
	generic "github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go/generic"
	trap "github.com/traPtitech/traq-flavored-markdown/packages/plugins/traq/go"
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
