// Code generated from Rust processing contracts. DO NOT EDIT.
package markdown

import (
	"bytes"
	"encoding/json"
	"fmt"
	"unicode/utf8"
)

func contractIsNull(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func contractObject(raw json.RawMessage) (map[string]json.RawMessage, error) {
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

func contractFields(object map[string]json.RawMessage, names ...string) error {
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

func contractDecode[T any](raw json.RawMessage, value *T) error {
	if contractIsNull(raw) {
		return fmt.Errorf("unexpected null")
	}
	if text, ok := any(value).(*string); ok {
		return contractString(raw, text)
	}
	return json.Unmarshal(raw, value)
}

func contractHex4(raw []byte) uint16 {
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
func contractString(raw json.RawMessage, value *string) error {
	if !utf8.Valid(raw) {
		return fmt.Errorf("invalid UTF-8")
	}
	if err := json.Unmarshal(raw, value); err != nil {
		return err
	}
	raw = bytes.TrimSpace(raw)
	for i := 1; i < len(raw)-1; i++ {
		if raw[i] != '\\' {
			continue
		}
		i++
		if raw[i] != 'u' {
			continue
		}
		unit := contractHex4(raw[i+1 : i+5])
		i += 4
		if unit >= 0xDC00 && unit <= 0xDFFF {
			return fmt.Errorf("unpaired Unicode surrogate")
		}
		if unit >= 0xD800 && unit <= 0xDBFF {
			if i+6 >= len(raw) || raw[i+1] != '\\' || raw[i+2] != 'u' {
				return fmt.Errorf("unpaired Unicode surrogate")
			}
			low := contractHex4(raw[i+3 : i+7])
			if low < 0xDC00 || low > 0xDFFF {
				return fmt.Errorf("unpaired Unicode surrogate")
			}
			i += 6
		}
	}
	return nil
}

func contractNullable[T any](raw json.RawMessage, value **T, decode func(json.RawMessage, *T) error) error {
	if contractIsNull(raw) {
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

func contractArray[T any](raw json.RawMessage, value *[]T, decode func(json.RawMessage, *T) error) error {
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

func contractEnum(value string, choices ...string) error {
	for _, choice := range choices {
		if value == choice {
			return nil
		}
	}
	return fmt.Errorf("invalid enum value %q", value)
}

type Extraction struct {
	Attachments        []string               `json:"attachments"`
	Citations          []string               `json:"citations"`
	MessageText        string                 `json:"messageText"`
	ReferenceEmbedding ReferenceEmbeddingPlan `json:"referenceEmbedding"`
	References         References             `json:"references"`
}

func (value *Extraction) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Extraction
	var decoded wire
	if err := contractFields(object, "attachments", "citations", "messageText", "referenceEmbedding", "references"); err != nil {
		return err
	}
	if raw, present := object["attachments"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contractArray(raw, value, contractDecode[string]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.Attachments); err != nil {
			return fmt.Errorf("field %q: %w", "attachments", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "attachments")
	}
	if raw, present := object["citations"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contractArray(raw, value, contractDecode[string]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.Citations); err != nil {
			return fmt.Errorf("field %q: %w", "citations", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "citations")
	}
	if raw, present := object["messageText"]; present {
		if err := (contractDecode[string])(raw, &decoded.MessageText); err != nil {
			return fmt.Errorf("field %q: %w", "messageText", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "messageText")
	}
	if raw, present := object["referenceEmbedding"]; present {
		if err := (contractDecode[ReferenceEmbeddingPlan])(raw, &decoded.ReferenceEmbedding); err != nil {
			return fmt.Errorf("field %q: %w", "referenceEmbedding", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "referenceEmbedding")
	}
	if raw, present := object["references"]; present {
		if err := (contractDecode[References])(raw, &decoded.References); err != nil {
			return fmt.Errorf("field %q: %w", "references", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "references")
	}
	*value = Extraction(decoded)
	return nil
}

type EmbeddedInfo struct {
	ID   string       `json:"id"`
	Raw  string       `json:"raw"`
	Type EmbeddedKind `json:"type"`
}

func (value *EmbeddedInfo) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire EmbeddedInfo
	var decoded wire
	if err := contractFields(object, "id", "raw", "type"); err != nil {
		return err
	}
	if raw, present := object["id"]; present {
		if err := (contractDecode[string])(raw, &decoded.ID); err != nil {
			return fmt.Errorf("field %q: %w", "id", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "id")
	}
	if raw, present := object["raw"]; present {
		if err := (contractDecode[string])(raw, &decoded.Raw); err != nil {
			return fmt.Errorf("field %q: %w", "raw", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "raw")
	}
	if raw, present := object["type"]; present {
		if err := (contractDecode[EmbeddedKind])(raw, &decoded.Type); err != nil {
			return fmt.Errorf("field %q: %w", "type", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "type")
	}
	*value = EmbeddedInfo(decoded)
	return nil
}

type EmbeddedKind string

const (
	EmbeddedKindUser    EmbeddedKind = "user"
	EmbeddedKindGroup   EmbeddedKind = "group"
	EmbeddedKindChannel EmbeddedKind = "channel"
	EmbeddedKindFile    EmbeddedKind = "file"
	EmbeddedKindMessage EmbeddedKind = "message"
)

func (value *EmbeddedKind) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "user", "group", "channel", "file", "message"); err != nil {
		return err
	}
	*value = EmbeddedKind(decoded)
	return nil
}
func (value EmbeddedKind) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "user", "group", "channel", "file", "message"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type LookupKind string

const (
	LookupKindUser    LookupKind = "user"
	LookupKindGroup   LookupKind = "group"
	LookupKindChannel LookupKind = "channel"
)

func (value *LookupKind) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "user", "group", "channel"); err != nil {
		return err
	}
	*value = LookupKind(decoded)
	return nil
}
func (value LookupKind) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "user", "group", "channel"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ReferenceEmbeddingCandidate struct {
	End   uint32     `json:"end"`
	Kind  LookupKind `json:"kind"`
	Name  string     `json:"name"`
	Raw   string     `json:"raw"`
	Start uint32     `json:"start"`
}

func (value *ReferenceEmbeddingCandidate) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire ReferenceEmbeddingCandidate
	var decoded wire
	if err := contractFields(object, "end", "kind", "name", "raw", "start"); err != nil {
		return err
	}
	if raw, present := object["end"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contractDecode(raw, value); err != nil {
				return err
			}
			if *value < 0 || *value > 4294967295 {
				return fmt.Errorf("number outside schema range")
			}
			return nil
		})(raw, &decoded.End); err != nil {
			return fmt.Errorf("field %q: %w", "end", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "end")
	}
	if raw, present := object["kind"]; present {
		if err := (contractDecode[LookupKind])(raw, &decoded.Kind); err != nil {
			return fmt.Errorf("field %q: %w", "kind", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "kind")
	}
	if raw, present := object["name"]; present {
		if err := (contractDecode[string])(raw, &decoded.Name); err != nil {
			return fmt.Errorf("field %q: %w", "name", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "name")
	}
	if raw, present := object["raw"]; present {
		if err := (contractDecode[string])(raw, &decoded.Raw); err != nil {
			return fmt.Errorf("field %q: %w", "raw", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "raw")
	}
	if raw, present := object["start"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contractDecode(raw, value); err != nil {
				return err
			}
			if *value < 0 || *value > 4294967295 {
				return fmt.Errorf("number outside schema range")
			}
			return nil
		})(raw, &decoded.Start); err != nil {
			return fmt.Errorf("field %q: %w", "start", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "start")
	}
	*value = ReferenceEmbeddingCandidate(decoded)
	return nil
}

type ReferenceEmbeddingPlan struct {
	Candidates     []ReferenceEmbeddingCandidate `json:"candidates"`
	UnembeddedText string                        `json:"unembeddedText"`
}

func (value *ReferenceEmbeddingPlan) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire ReferenceEmbeddingPlan
	var decoded wire
	if err := contractFields(object, "candidates", "unembeddedText"); err != nil {
		return err
	}
	if raw, present := object["candidates"]; present {
		if err := (func(raw json.RawMessage, value *[]ReferenceEmbeddingCandidate) error {
			if err := contractArray(raw, value, contractDecode[ReferenceEmbeddingCandidate]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.Candidates); err != nil {
			return fmt.Errorf("field %q: %w", "candidates", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "candidates")
	}
	if raw, present := object["unembeddedText"]; present {
		if err := (contractDecode[string])(raw, &decoded.UnembeddedText); err != nil {
			return fmt.Errorf("field %q: %w", "unembeddedText", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "unembeddedText")
	}
	*value = ReferenceEmbeddingPlan(decoded)
	return nil
}

type References struct {
	ChannelLinks  []string       `json:"channelLinks"`
	Embeddings    []EmbeddedInfo `json:"embeddings"`
	GroupMentions []string       `json:"groupMentions"`
	Mentions      []string       `json:"mentions"`
}

func (value *References) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire References
	var decoded wire
	if err := contractFields(object, "channelLinks", "embeddings", "groupMentions", "mentions"); err != nil {
		return err
	}
	if raw, present := object["channelLinks"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contractArray(raw, value, contractDecode[string]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.ChannelLinks); err != nil {
			return fmt.Errorf("field %q: %w", "channelLinks", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "channelLinks")
	}
	if raw, present := object["embeddings"]; present {
		if err := (func(raw json.RawMessage, value *[]EmbeddedInfo) error {
			if err := contractArray(raw, value, contractDecode[EmbeddedInfo]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.Embeddings); err != nil {
			return fmt.Errorf("field %q: %w", "embeddings", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "embeddings")
	}
	if raw, present := object["groupMentions"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contractArray(raw, value, contractDecode[string]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.GroupMentions); err != nil {
			return fmt.Errorf("field %q: %w", "groupMentions", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "groupMentions")
	}
	if raw, present := object["mentions"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contractArray(raw, value, contractDecode[string]); err != nil {
				return err
			}
			return nil
		})(raw, &decoded.Mentions); err != nil {
			return fmt.Errorf("field %q: %w", "mentions", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "mentions")
	}
	*value = References(decoded)
	return nil
}

type ExtractorOptions struct {
	Origin string `json:"origin,omitempty"`
}

func (value *ExtractorOptions) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire ExtractorOptions
	var decoded wire
	if err := contractFields(object, "origin"); err != nil {
		return err
	}
	if raw, present := object["origin"]; present {
		if err := (contractDecode[string])(raw, &decoded.Origin); err != nil {
			return fmt.Errorf("field %q: %w", "origin", err)
		}
	} else {
		if err := (contractDecode[string])(json.RawMessage("\"\""), &decoded.Origin); err != nil {
			return err
		}
	}
	*value = ExtractorOptions(decoded)
	return nil
}

type RendererOptions struct {
	Origin string `json:"origin,omitempty"`
}

func (value *RendererOptions) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire RendererOptions
	var decoded wire
	if err := contractFields(object, "origin"); err != nil {
		return err
	}
	if raw, present := object["origin"]; present {
		if err := (contractDecode[string])(raw, &decoded.Origin); err != nil {
			return fmt.Errorf("field %q: %w", "origin", err)
		}
	} else {
		if err := (contractDecode[string])(json.RawMessage("\"\""), &decoded.Origin); err != nil {
			return err
		}
	}
	*value = RendererOptions(decoded)
	return nil
}
