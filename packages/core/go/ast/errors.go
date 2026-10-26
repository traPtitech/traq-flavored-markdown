package ast

// ValidationError identifies an invalid document without requiring message parsing.
type ValidationError struct {
	Path     string
	Resource string
	Message  string
	Span     *Span
}

func (e *ValidationError) Error() string { return e.Path + ": " + e.Message }
func invalid(path, message string) error { return &ValidationError{Path: path, Message: message} }
func limit(path, resource string) error {
	return &ValidationError{Path: path, Resource: resource, Message: resource + " limit exceeded"}
}
