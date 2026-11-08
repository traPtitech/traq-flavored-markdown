package binding

import (
	"errors"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
)

// Error retains stable wire diagnostics and host-side operation/cause context.
type Error struct {
	Code        string    `json:"code"`
	Message     string    `json:"message"`
	Resource    string    `json:"resource,omitempty"`
	Path        string    `json:"path,omitempty"`
	Offset      *uint32   `json:"offset,omitempty"`
	Span        *ast.Span `json:"span,omitempty"`
	Phase       string    `json:"phase,omitempty"`
	Rule        string    `json:"rule,omitempty"`
	PayloadType string    `json:"payload_type,omitempty"`
	Operation   string    `json:"-"`
	Cause       error     `json:"-"`
}

func (e *Error) Error() string            { return e.Code + ": " + e.Message }
func (e *Error) Unwrap() error            { return e.Cause }
func failure(code, message string) *Error { return &Error{Code: code, Message: message} }

func causedFailure(code string, cause error) *Error {
	return &Error{Code: code, Message: cause.Error(), Cause: cause}
}

// WithOperation preserves errors.Is/errors.As while adding operation context.
func WithOperation(err error, operation string) error {
	if err == nil {
		return nil
	}

	var typed *Error

	if errors.As(err, &typed) {
		if typed.Operation == operation {
			return err
		}

		contextual := *typed
		contextual.Operation = operation
		contextual.Cause = err

		return &contextual
	}

	return &Error{Code: "transport_error", Message: err.Error(), Operation: operation, Cause: err}
}

func resource(name string) *Error {
	return &Error{Code: "resource_limit", Message: name + " limit exceeded", Resource: name}
}

// DocumentError preserves structured validation diagnostics and their original cause.
func DocumentError(err error) error {
	if err == nil {
		return nil
	}

	var validation *ast.ValidationError

	if errors.As(err, &validation) {
		code := "invalid_document"
		if validation.Resource != "" {
			code = "resource_limit"
		}

		return &Error{Code: code, Message: validation.Message, Path: validation.Path, Resource: validation.Resource, Span: validation.Span, Cause: err}
	}

	return causedFailure("invalid_document", err)
}
