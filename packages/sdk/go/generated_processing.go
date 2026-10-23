// Code generated from Rust contracts. DO NOT EDIT.
package markdown

import (
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
)

type Extraction struct {
	Attachments        []string               `json:"attachments"`
	Citations          []string               `json:"citations"`
	MessageText        string                 `json:"messageText"`
	ReferenceEmbedding ReferenceEmbeddingPlan `json:"referenceEmbedding"`
	References         References             `json:"references"`
}

func (value *Extraction) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Extraction
	var decoded wire
	if err := contract.Fields(object, "attachments", "citations", "messageText", "referenceEmbedding", "references"); err != nil {
		return err
	}
	if raw, present := object["attachments"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contract.Array(raw, value, contract.Decode[string]); err != nil {
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
			if err := contract.Array(raw, value, contract.Decode[string]); err != nil {
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
		if err := (contract.Decode[string])(raw, &decoded.MessageText); err != nil {
			return fmt.Errorf("field %q: %w", "messageText", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "messageText")
	}
	if raw, present := object["referenceEmbedding"]; present {
		if err := (contract.Decode[ReferenceEmbeddingPlan])(raw, &decoded.ReferenceEmbedding); err != nil {
			return fmt.Errorf("field %q: %w", "referenceEmbedding", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "referenceEmbedding")
	}
	if raw, present := object["references"]; present {
		if err := (contract.Decode[References])(raw, &decoded.References); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire EmbeddedInfo
	var decoded wire
	if err := contract.Fields(object, "id", "raw", "type"); err != nil {
		return err
	}
	if raw, present := object["id"]; present {
		if err := (contract.Decode[string])(raw, &decoded.ID); err != nil {
			return fmt.Errorf("field %q: %w", "id", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "id")
	}
	if raw, present := object["raw"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Raw); err != nil {
			return fmt.Errorf("field %q: %w", "raw", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "raw")
	}
	if raw, present := object["type"]; present {
		if err := (contract.Decode[EmbeddedKind])(raw, &decoded.Type); err != nil {
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
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "user", "group", "channel", "file", "message"); err != nil {
		return err
	}
	*value = EmbeddedKind(decoded)
	return nil
}
func (value EmbeddedKind) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "user", "group", "channel", "file", "message"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ReferenceEmbeddingCandidate struct {
	End   uint32        `json:"end"`
	Kind  ReferenceKind `json:"kind"`
	Name  string        `json:"name"`
	Raw   string        `json:"raw"`
	Start uint32        `json:"start"`
}

func (value *ReferenceEmbeddingCandidate) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ReferenceEmbeddingCandidate
	var decoded wire
	if err := contract.Fields(object, "end", "kind", "name", "raw", "start"); err != nil {
		return err
	}
	if raw, present := object["end"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contract.Decode(raw, value); err != nil {
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
		if err := (contract.Decode[ReferenceKind])(raw, &decoded.Kind); err != nil {
			return fmt.Errorf("field %q: %w", "kind", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "kind")
	}
	if raw, present := object["name"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Name); err != nil {
			return fmt.Errorf("field %q: %w", "name", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "name")
	}
	if raw, present := object["raw"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Raw); err != nil {
			return fmt.Errorf("field %q: %w", "raw", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "raw")
	}
	if raw, present := object["start"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contract.Decode(raw, value); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ReferenceEmbeddingPlan
	var decoded wire
	if err := contract.Fields(object, "candidates", "unembeddedText"); err != nil {
		return err
	}
	if raw, present := object["candidates"]; present {
		if err := (func(raw json.RawMessage, value *[]ReferenceEmbeddingCandidate) error {
			if err := contract.Array(raw, value, contract.Decode[ReferenceEmbeddingCandidate]); err != nil {
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
		if err := (contract.Decode[string])(raw, &decoded.UnembeddedText); err != nil {
			return fmt.Errorf("field %q: %w", "unembeddedText", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "unembeddedText")
	}
	*value = ReferenceEmbeddingPlan(decoded)
	return nil
}

type ReferenceKind string

const (
	ReferenceKindUser    ReferenceKind = "user"
	ReferenceKindGroup   ReferenceKind = "group"
	ReferenceKindChannel ReferenceKind = "channel"
)

func (value *ReferenceKind) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "user", "group", "channel"); err != nil {
		return err
	}
	*value = ReferenceKind(decoded)
	return nil
}
func (value ReferenceKind) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "user", "group", "channel"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type References struct {
	ChannelLinks  []string       `json:"channelLinks"`
	Embeddings    []EmbeddedInfo `json:"embeddings"`
	GroupMentions []string       `json:"groupMentions"`
	Mentions      []string       `json:"mentions"`
}

func (value *References) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire References
	var decoded wire
	if err := contract.Fields(object, "channelLinks", "embeddings", "groupMentions", "mentions"); err != nil {
		return err
	}
	if raw, present := object["channelLinks"]; present {
		if err := (func(raw json.RawMessage, value *[]string) error {
			if err := contract.Array(raw, value, contract.Decode[string]); err != nil {
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
			if err := contract.Array(raw, value, contract.Decode[EmbeddedInfo]); err != nil {
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
			if err := contract.Array(raw, value, contract.Decode[string]); err != nil {
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
			if err := contract.Array(raw, value, contract.Decode[string]); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ExtractorOptions
	var decoded wire
	if err := contract.Fields(object, "origin"); err != nil {
		return err
	}
	if raw, present := object["origin"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Origin); err != nil {
			return fmt.Errorf("field %q: %w", "origin", err)
		}
	} else {
		if err := (contract.Decode[string])(json.RawMessage("\"\""), &decoded.Origin); err != nil {
			return err
		}
	}
	*value = ExtractorOptions(decoded)
	return nil
}

type PlainTextOptions struct {
	Origin     string           `json:"origin,omitempty"`
	Whitespace WhitespacePolicy `json:"whitespace,omitempty"`
}

func (value *PlainTextOptions) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire PlainTextOptions
	var decoded wire
	if err := contract.Fields(object, "origin", "whitespace"); err != nil {
		return err
	}
	if raw, present := object["origin"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Origin); err != nil {
			return fmt.Errorf("field %q: %w", "origin", err)
		}
	} else {
		if err := (contract.Decode[string])(json.RawMessage("\"\""), &decoded.Origin); err != nil {
			return err
		}
	}
	if raw, present := object["whitespace"]; present {
		if err := (contract.Decode[WhitespacePolicy])(raw, &decoded.Whitespace); err != nil {
			return fmt.Errorf("field %q: %w", "whitespace", err)
		}
	} else {
		if err := (contract.Decode[WhitespacePolicy])(json.RawMessage("\"collapse\""), &decoded.Whitespace); err != nil {
			return err
		}
	}
	*value = PlainTextOptions(decoded)
	return nil
}

type WhitespacePolicy string

const (
	WhitespacePolicyPreserve WhitespacePolicy = "preserve"
	WhitespacePolicyCollapse WhitespacePolicy = "collapse"
)

func (value *WhitespacePolicy) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "preserve", "collapse"); err != nil {
		return err
	}
	*value = WhitespacePolicy(decoded)
	return nil
}
func (value WhitespacePolicy) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "preserve", "collapse"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ProcessingResult struct {
	Extraction Extraction `json:"extraction"`
	PlainText  string     `json:"plainText"`
}

func (value *ProcessingResult) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ProcessingResult
	var decoded wire
	if err := contract.Fields(object, "extraction", "plainText"); err != nil {
		return err
	}
	if raw, present := object["extraction"]; present {
		if err := (contract.Decode[Extraction])(raw, &decoded.Extraction); err != nil {
			return fmt.Errorf("field %q: %w", "extraction", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "extraction")
	}
	if raw, present := object["plainText"]; present {
		if err := (contract.Decode[string])(raw, &decoded.PlainText); err != nil {
			return fmt.Errorf("field %q: %w", "plainText", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "plainText")
	}
	*value = ProcessingResult(decoded)
	return nil
}

type ProcessorConfiguration struct {
	Options ProcessorOptions `json:"options"`
	Preset  string           `json:"preset"`
}

func (value *ProcessorConfiguration) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ProcessorConfiguration
	var decoded wire
	if err := contract.Fields(object, "options", "preset"); err != nil {
		return err
	}
	if raw, present := object["options"]; present {
		if err := (contract.Decode[ProcessorOptions])(raw, &decoded.Options); err != nil {
			return fmt.Errorf("field %q: %w", "options", err)
		}
	} else {
		if err := (contract.Decode[ProcessorOptions])(json.RawMessage("{\"origin\":\"\",\"whitespace\":\"collapse\"}"), &decoded.Options); err != nil {
			return err
		}
	}
	if raw, present := object["preset"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Preset); err != nil {
			return fmt.Errorf("field %q: %w", "preset", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "preset")
	}
	*value = ProcessorConfiguration(decoded)
	return nil
}

type ProcessorOptions struct {
	Origin     string           `json:"origin,omitempty"`
	Whitespace WhitespacePolicy `json:"whitespace,omitempty"`
}

func (value *ProcessorOptions) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ProcessorOptions
	var decoded wire
	if err := contract.Fields(object, "origin", "whitespace"); err != nil {
		return err
	}
	if raw, present := object["origin"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Origin); err != nil {
			return fmt.Errorf("field %q: %w", "origin", err)
		}
	} else {
		if err := (contract.Decode[string])(json.RawMessage("\"\""), &decoded.Origin); err != nil {
			return err
		}
	}
	if raw, present := object["whitespace"]; present {
		if err := (contract.Decode[WhitespacePolicy])(raw, &decoded.Whitespace); err != nil {
			return fmt.Errorf("field %q: %w", "whitespace", err)
		}
	} else {
		if err := (contract.Decode[WhitespacePolicy])(json.RawMessage("\"collapse\""), &decoded.Whitespace); err != nil {
			return err
		}
	}
	*value = ProcessorOptions(decoded)
	return nil
}
