package markdown

import (
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
)

// Error carries stable failure codes and optional source/document diagnostics.
type Error = binding.Error

// ValidatedDocument is an immutable owned snapshot reusable by processors.
type ValidatedDocument = ast.ValidatedDocument
