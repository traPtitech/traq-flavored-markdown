package ast

import (
	"strings"
	"unicode/utf8"
)

// SourceText owns exact UTF-8 source bytes and checks all byte-oriented edits.
type SourceText struct{ text string }
type SourceEdit struct {
	Span Span
	Text string
}

func NewSourceText(source string) (SourceText, error) {
	if err := ValidateSource(source); err != nil {
		return SourceText{}, err
	}
	return SourceText{text: source}, nil
}
func (s SourceText) String() string { return s.text }
func (s SourceText) Slice(span Span) (string, error) {
	if span.Start > span.End || !IsBoundary(s.text, span.Start) || !IsBoundary(s.text, span.End) {
		return "", invalid("$.span", "span is outside source or splits UTF-8")
	}
	return s.text[span.Start:span.End], nil
}
func (s SourceText) Replace(edits []SourceEdit) (string, error) {
	if len(edits) == 0 {
		return s.text, nil
	}
	var output strings.Builder
	position := uint32(0)
	for _, edit := range edits {
		if edit.Span.Start < position {
			return "", invalid("$.edits", "source edits must be ordered and disjoint")
		}
		if _, err := s.Slice(edit.Span); err != nil {
			return "", err
		}
		if !utf8.ValidString(edit.Text) {
			return "", invalid("$.edits", "replacement is not valid UTF-8")
		}
		output.WriteString(s.text[position:edit.Span.Start])
		output.WriteString(edit.Text)
		position = edit.Span.End
	}
	output.WriteString(s.text[position:])
	return output.String(), nil
}

// ValidateSource preserves valid bytes exactly, including BOM, CRLF and NUL.
func ValidateSource(source string) error {
	if len(source) > maxSourceBytes {
		return limit("$.source", "source_bytes")
	}
	if !utf8.ValidString(source) {
		return invalid("$.source", "invalid UTF-8")
	}
	return nil
}

// IsBoundary reports whether an offset is a UTF-8 byte boundary in source.
func IsBoundary(source string, position uint32) bool {
	return uint64(position) <= uint64(len(source)) && (int(position) == len(source) || utf8.RuneStart(source[position]))
}
