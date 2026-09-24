// Code generated from Rust processing contracts. DO NOT EDIT.
package markdown

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type contractCheck func(json.RawMessage) error

func contractIsNull(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func contractObject(raw json.RawMessage, required, optional map[string]contractCheck) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil {
		return err
	}
	if object == nil {
		return fmt.Errorf("expected object")
	}
	for key, check := range required {
		value, present := object[key]
		if !present {
			return fmt.Errorf("missing required field %q", key)
		}
		if err := check(value); err != nil {
			return fmt.Errorf("field %q: %w", key, err)
		}
	}
	for key, value := range object {
		if _, present := required[key]; present {
			continue
		}
		check, present := optional[key]
		if !present {
			return fmt.Errorf("unknown field %q", key)
		}
		if err := check(value); err != nil {
			return fmt.Errorf("field %q: %w", key, err)
		}
	}
	return nil
}

func contractArray(raw json.RawMessage, item contractCheck) error {
	var array []json.RawMessage
	if err := json.Unmarshal(raw, &array); err != nil {
		return err
	}
	if array == nil {
		return fmt.Errorf("expected array")
	}
	for index, value := range array {
		if err := item(value); err != nil {
			return fmt.Errorf("item %d: %w", index, err)
		}
	}
	return nil
}

func contractNullable(raw json.RawMessage, inner contractCheck) error {
	if contractIsNull(raw) {
		return nil
	}
	return inner(raw)
}

func contractString(raw json.RawMessage) error {
	if contractIsNull(raw) {
		return fmt.Errorf("expected string")
	}
	var value string
	return json.Unmarshal(raw, &value)
}

func contractBoolean(raw json.RawMessage) error {
	if contractIsNull(raw) {
		return fmt.Errorf("expected boolean")
	}
	var value bool
	return json.Unmarshal(raw, &value)
}

func contractInteger(raw json.RawMessage, min, max uint64) error {
	if contractIsNull(raw) {
		return fmt.Errorf("expected integer")
	}
	var value uint64
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	if value < min || value > max {
		return fmt.Errorf("integer out of range")
	}
	return nil
}

func contractEnum(raw json.RawMessage, choices ...string) error {
	if err := contractString(raw); err != nil {
		return err
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	for _, choice := range choices {
		if value == choice {
			return nil
		}
	}
	return fmt.Errorf("invalid enum value %q", value)
}

func contractUnion(raw json.RawMessage, variants ...contractCheck) error {
	matches := 0
	for _, check := range variants {
		if check(raw) == nil {
			matches++
		}
	}
	if matches != 1 {
		return fmt.Errorf("expected exactly one union variant")
	}
	return nil
}

type Extraction struct {
	Attachments []string      `json:"attachments"`
	Citations   []string      `json:"citations"`
	Embedding   EmbeddingPlan `json:"embedding"`
	MessageText string        `json:"messageText"`
	References  References    `json:"references"`
}

func (value *Extraction) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"attachments": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "citations": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "embedding": func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"candidates": func(raw json.RawMessage) error {
				return contractArray(raw, func(raw json.RawMessage) error {
					return contractObject(raw, map[string]contractCheck{"end": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "kind": func(raw json.RawMessage) error { return contractEnum(raw, "user", "group", "channel") }, "name": contractString, "raw": contractString, "start": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }}, map[string]contractCheck{})
				})
			}, "unembeddedText": contractString}, map[string]contractCheck{})
		}, "messageText": contractString, "references": func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"channelLinks": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "embeddings": func(raw json.RawMessage) error {
				return contractArray(raw, func(raw json.RawMessage) error {
					return contractObject(raw, map[string]contractCheck{"id": contractString, "raw": contractString, "type": contractString}, map[string]contractCheck{})
				})
			}, "groupMentions": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "mentions": func(raw json.RawMessage) error { return contractArray(raw, contractString) }}, map[string]contractCheck{})
		}}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Extraction
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Extraction(decoded)
	return nil
}

type EmbeddedInfo struct {
	ID   string `json:"id"`
	Raw  string `json:"raw"`
	Type string `json:"type"`
}

func (value *EmbeddedInfo) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"id": contractString, "raw": contractString, "type": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire EmbeddedInfo
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = EmbeddedInfo(decoded)
	return nil
}

type EmbeddingCandidate struct {
	End   uint32     `json:"end"`
	Kind  LookupKind `json:"kind"`
	Name  string     `json:"name"`
	Raw   string     `json:"raw"`
	Start uint32     `json:"start"`
}

func (value *EmbeddingCandidate) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"end": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "kind": func(raw json.RawMessage) error { return contractEnum(raw, "user", "group", "channel") }, "name": contractString, "raw": contractString, "start": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire EmbeddingCandidate
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = EmbeddingCandidate(decoded)
	return nil
}

type EmbeddingPlan struct {
	Candidates     []EmbeddingCandidate `json:"candidates"`
	UnembeddedText string               `json:"unembeddedText"`
}

func (value *EmbeddingPlan) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"candidates": func(raw json.RawMessage) error {
			return contractArray(raw, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"end": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "kind": func(raw json.RawMessage) error { return contractEnum(raw, "user", "group", "channel") }, "name": contractString, "raw": contractString, "start": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }}, map[string]contractCheck{})
			})
		}, "unembeddedText": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire EmbeddingPlan
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = EmbeddingPlan(decoded)
	return nil
}

type LookupKind string

const (
	LookupKindUser    LookupKind = "user"
	LookupKindGroup   LookupKind = "group"
	LookupKindChannel LookupKind = "channel"
)

func (value *LookupKind) UnmarshalJSON(raw []byte) error {
	if err := contractEnum(raw, "user", "group", "channel"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = LookupKind(decoded)
	return nil
}
func (value LookupKind) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "user", "group", "channel"); err != nil {
		return nil, err
	}
	return raw, nil
}

type References struct {
	ChannelLinks  []string       `json:"channelLinks"`
	Embeddings    []EmbeddedInfo `json:"embeddings"`
	GroupMentions []string       `json:"groupMentions"`
	Mentions      []string       `json:"mentions"`
}

func (value *References) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"channelLinks": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "embeddings": func(raw json.RawMessage) error {
			return contractArray(raw, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"id": contractString, "raw": contractString, "type": contractString}, map[string]contractCheck{})
			})
		}, "groupMentions": func(raw json.RawMessage) error { return contractArray(raw, contractString) }, "mentions": func(raw json.RawMessage) error { return contractArray(raw, contractString) }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire References
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = References(decoded)
	return nil
}

type ExtractorOptions struct {
	Origin string `json:"origin"`
}

func (value *ExtractorOptions) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"origin": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire ExtractorOptions
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = ExtractorOptions(decoded)
	return nil
}

type RendererOptions struct {
	Origin string `json:"origin"`
}

func (value *RendererOptions) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"origin": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire RendererOptions
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = RendererOptions(decoded)
	return nil
}
