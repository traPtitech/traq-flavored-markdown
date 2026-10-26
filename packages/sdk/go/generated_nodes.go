// Code generated from Rust contract ownership. DO NOT EDIT.
package markdown

import (
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	commonmark "github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go"
	extensions "github.com/traPtitech/traq-flavored-markdown/packages/plugins/extensions/go"
	traq "github.com/traPtitech/traq-flavored-markdown/packages/plugins/traq/go"
)

type Document = ast.Document
type Node = ast.Node
type MutableDocument = ast.MutableDocument
type MutableNode = ast.MutableNode
type Span = ast.Span
type Payload = ast.Payload

func DecodeDocument(raw []byte) (*Document, error) { return ast.DecodeDocument(raw, newPayload) }
func NewDocument(document *MutableDocument) (*Document, error) {
	return ast.NewDocument(document, newPayload)
}
func newPayload(kind string) ast.Payload {
	if value := commonmark.NewPayload(kind); value != nil {
		return value
	}
	if value := extensions.NewPayload(kind); value != nil {
		return value
	}
	if value := traq.NewPayload(kind); value != nil {
		return value
	}
	return nil
}
