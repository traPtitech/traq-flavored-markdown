package contract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"unicode/utf8"
)

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
	return validateUnicode(raw)
}

// Call only after JSON syntax has been checked.
func validateUnicode(raw []byte) error {
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
			value := hex4(raw[i+1 : i+5])
			i += 4
			if value >= 0xDC00 && value <= 0xDFFF {
				return fmt.Errorf("unpaired Unicode surrogate")
			}
			if value >= 0xD800 && value <= 0xDBFF {
				if i+6 >= len(raw) || raw[i+1] != '\\' || raw[i+2] != 'u' {
					return fmt.Errorf("unpaired Unicode surrogate")
				}
				low := hex4(raw[i+3 : i+7])
				if low < 0xDC00 || low > 0xDFFF {
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
