package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
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

// ValidateJSON rejects the lossy Unicode replacements accepted by encoding/json.
func ValidateJSON(raw []byte) error {
	if !utf8.Valid(raw) {
		return fmt.Errorf("invalid UTF-8")
	}
	if !json.Valid(raw) {
		return fmt.Errorf("invalid JSON")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := distinctFields(decoder); err != nil {
		return err
	}
	for i := 0; i < len(raw); i++ {
		if raw[i] != '"' {
			continue
		}
		i++
		for ; i < len(raw) && raw[i] != '"'; i++ {
			if raw[i] != '\\' {
				continue
			}
			i++
			if raw[i] != 'u' {
				continue
			}
			value, _ := strconv.ParseUint(string(raw[i+1:i+5]), 16, 16)
			i += 4
			if value >= 0xDC00 && value <= 0xDFFF {
				return fmt.Errorf("unpaired Unicode surrogate")
			}
			if value >= 0xD800 && value <= 0xDBFF {
				if i+6 >= len(raw) || raw[i+1] != '\\' || raw[i+2] != 'u' {
					return fmt.Errorf("unpaired Unicode surrogate")
				}
				low, err := strconv.ParseUint(string(raw[i+3:i+7]), 16, 16)
				if err != nil || low < 0xDC00 || low > 0xDFFF {
					return fmt.Errorf("unpaired Unicode surrogate")
				}
				i += 6
			}
		}
	}
	return nil
}

// encoding/json accepts repeated keys; the Rust wire codec rejects them.
func distinctFields(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delimiter, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	if delimiter == '{' {
		seen := map[string]bool{}
		for decoder.More() {
			key, err := decoder.Token()
			if err != nil {
				return err
			}
			name := key.(string)
			if seen[name] {
				return fmt.Errorf("duplicate JSON field: %s", name)
			}
			seen[name] = true
			if err := distinctFields(decoder); err != nil {
				return err
			}
		}
	} else if delimiter == '[' {
		for decoder.More() {
			if err := distinctFields(decoder); err != nil {
				return err
			}
		}
	}
	_, err = decoder.Token()
	return err
}
