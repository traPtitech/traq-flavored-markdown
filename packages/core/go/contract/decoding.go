// Package contract supplies strict JSON primitives for generated wire contracts.
package contract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"unicode/utf8"
)

func isNull(raw json.RawMessage) bool { return bytes.Equal(bytes.TrimSpace(raw), []byte("null")) }

func Object(raw json.RawMessage) (map[string]json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	if token != json.Delim('{') {
		return nil, fmt.Errorf("expected object")
	}
	object := make(map[string]json.RawMessage)
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		name, ok := token.(string)
		if !ok {
			return nil, fmt.Errorf("expected field name")
		}
		if _, exists := object[name]; exists {
			return nil, fmt.Errorf("duplicate field %q", name)
		}
		var field json.RawMessage
		if err := decoder.Decode(&field); err != nil {
			return nil, err
		}
		object[name] = field
	}
	if _, err := decoder.Token(); err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(raw[decoder.InputOffset():])) != 0 {
		return nil, fmt.Errorf("trailing JSON data")
	}
	return object, nil
}

func Fields(object map[string]json.RawMessage, names ...string) error {
	for name := range object {
		found := false
		for _, allowed := range names {
			if name == allowed {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("unknown field %q", name)
		}
	}
	return nil
}

func Decode[T any](raw json.RawMessage, value *T) error {
	if isNull(raw) {
		return fmt.Errorf("unexpected null")
	}
	if text, ok := any(value).(*string); ok {
		return decodeString(raw, text)
	}
	return json.Unmarshal(raw, value)
}

func hex4(raw []byte) uint16 {
	var value uint16
	for _, digit := range raw {
		value <<= 4
		switch {
		case digit >= '0' && digit <= '9':
			value |= uint16(digit - '0')
		case digit >= 'a' && digit <= 'f':
			value |= uint16(digit - 'a' + 10)
		default:
			value |= uint16(digit - 'A' + 10)
		}
	}
	return value
}

// Check scalar strings only: nested objects and arrays retain one decoding pass.
func decodeString(raw json.RawMessage, value *string) error {
	if !utf8.Valid(raw) {
		return fmt.Errorf("invalid UTF-8")
	}
	if err := json.Unmarshal(raw, value); err != nil {
		return err
	}
	return validateUnicode(raw)
}

func Nullable[T any](raw json.RawMessage, value **T, decode func(json.RawMessage, *T) error) error {
	if isNull(raw) {
		*value = nil
		return nil
	}
	var decoded T
	if err := decode(raw, &decoded); err != nil {
		return err
	}
	*value = &decoded
	return nil
}

func Array[T any](raw json.RawMessage, value *[]T, decode func(json.RawMessage, *T) error) error {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return err
	}
	if items == nil {
		return fmt.Errorf("expected array")
	}
	decoded := make([]T, len(items))
	for index, item := range items {
		if err := decode(item, &decoded[index]); err != nil {
			return fmt.Errorf("item %d: %w", index, err)
		}
	}
	*value = decoded
	return nil
}

func Enum(value string, choices ...string) error {
	for _, choice := range choices {
		if value == choice {
			return nil
		}
	}
	return fmt.Errorf("invalid enum value %q", value)
}
