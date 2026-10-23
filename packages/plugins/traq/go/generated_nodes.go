// Code generated from Rust contracts. DO NOT EDIT.
package traq

import (
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
	"unicode/utf8"
)

type BlankLine struct {
}

func (value *BlankLine) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire BlankLine
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = BlankLine(decoded)
	return nil
}

type Embedding struct {
	ID      ReferenceIdentity `json:"id"`
	Label   string            `json:"label"`
	Literal string            `json:"literal"`
	Type    EmbeddingKind     `json:"type"`
}

func (value *Embedding) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Embedding
	var decoded wire
	if err := contract.Fields(object, "id", "label", "literal", "type"); err != nil {
		return err
	}
	if raw, present := object["id"]; present {
		if err := (contract.Decode[ReferenceIdentity])(raw, &decoded.ID); err != nil {
			return fmt.Errorf("field %q: %w", "id", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "id")
	}
	if raw, present := object["label"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Label); err != nil {
			return fmt.Errorf("field %q: %w", "label", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "label")
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	if raw, present := object["type"]; present {
		if err := (contract.Decode[EmbeddingKind])(raw, &decoded.Type); err != nil {
			return fmt.Errorf("field %q: %w", "type", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "type")
	}
	*value = Embedding(decoded)
	return nil
}

type EmbeddingKind string

const (
	EmbeddingKindFile    EmbeddingKind = "file"
	EmbeddingKindMessage EmbeddingKind = "message"
)

func (value *EmbeddingKind) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "file", "message"); err != nil {
		return err
	}
	*value = EmbeddingKind(decoded)
	return nil
}
func (value EmbeddingKind) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "file", "message"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ReferenceIdentity string

func (value *ReferenceIdentity) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := (contract.Decode[string])(raw, &decoded); err != nil {
		return err
	}
	*value = ReferenceIdentity(decoded)
	return nil
}
func (value ReferenceIdentity) MarshalJSON() ([]byte, error) {
	if !utf8.ValidString(string(value)) {
		return nil, fmt.Errorf("invalid UTF-8")
	}
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	var checked ReferenceIdentity
	if err := json.Unmarshal(raw, &checked); err != nil {
		return nil, err
	}
	return raw, nil
}

type Reference struct {
	ID    ReferenceIdentity `json:"id"`
	Label string            `json:"label"`
	Type  ReferenceKind     `json:"type"`
}

func (value *Reference) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Reference
	var decoded wire
	if err := contract.Fields(object, "id", "label", "type"); err != nil {
		return err
	}
	if raw, present := object["id"]; present {
		if err := (contract.Decode[ReferenceIdentity])(raw, &decoded.ID); err != nil {
			return fmt.Errorf("field %q: %w", "id", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "id")
	}
	if raw, present := object["label"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Label); err != nil {
			return fmt.Errorf("field %q: %w", "label", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "label")
	}
	if raw, present := object["type"]; present {
		if err := (contract.Decode[ReferenceKind])(raw, &decoded.Type); err != nil {
			return fmt.Errorf("field %q: %w", "type", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "type")
	}
	*value = Reference(decoded)
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

type Spoiler struct {
}

func (value *Spoiler) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Spoiler
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Spoiler(decoded)
	return nil
}

type Stamp struct {
	Effects StampEffects `json:"effects"`
	Kind    StampKind    `json:"kind"`
	Literal string       `json:"literal"`
}

func (value *Stamp) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Stamp
	var decoded wire
	if err := contract.Fields(object, "effects", "kind", "literal"); err != nil {
		return err
	}
	if raw, present := object["effects"]; present {
		if err := (contract.Decode[StampEffects])(raw, &decoded.Effects); err != nil {
			return fmt.Errorf("field %q: %w", "effects", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "effects")
	}
	if raw, present := object["kind"]; present {
		if err := (contract.Decode[StampKind])(raw, &decoded.Kind); err != nil {
			return fmt.Errorf("field %q: %w", "kind", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "kind")
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	*value = Stamp(decoded)
	return nil
}

type StampAnimation string

const (
	StampAnimationRotate    StampAnimation = "rotate"
	StampAnimationRotateInv StampAnimation = "rotate-inv"
	StampAnimationWiggle    StampAnimation = "wiggle"
	StampAnimationParrot    StampAnimation = "parrot"
	StampAnimationZoom      StampAnimation = "zoom"
	StampAnimationInversion StampAnimation = "inversion"
	StampAnimationTurn      StampAnimation = "turn"
	StampAnimationTurnV     StampAnimation = "turn-v"
	StampAnimationHappa     StampAnimation = "happa"
	StampAnimationPyon      StampAnimation = "pyon"
	StampAnimationFlashy    StampAnimation = "flashy"
	StampAnimationPull      StampAnimation = "pull"
	StampAnimationAtsumori  StampAnimation = "atsumori"
	StampAnimationStretch   StampAnimation = "stretch"
	StampAnimationStretchV  StampAnimation = "stretch-v"
	StampAnimationConga     StampAnimation = "conga"
	StampAnimationCongaInv  StampAnimation = "conga-inv"
	StampAnimationRainbow   StampAnimation = "rainbow"
	StampAnimationAscension StampAnimation = "ascension"
	StampAnimationShake     StampAnimation = "shake"
	StampAnimationParty     StampAnimation = "party"
	StampAnimationAttract   StampAnimation = "attract"
)

func (value *StampAnimation) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract"); err != nil {
		return err
	}
	*value = StampAnimation(decoded)
	return nil
}
func (value StampAnimation) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type StampEffects struct {
	Animations []StampAnimation `json:"animations"`
	Size       StampSize        `json:"size"`
}

func (value *StampEffects) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire StampEffects
	var decoded wire
	if err := contract.Fields(object, "animations", "size"); err != nil {
		return err
	}
	if raw, present := object["animations"]; present {
		if err := (func(raw json.RawMessage, value *[]StampAnimation) error {
			if err := contract.Array(raw, value, contract.Decode[StampAnimation]); err != nil {
				return err
			}
			if len(*value) > 5 {
				return fmt.Errorf("array longer than schema bound")
			}
			return nil
		})(raw, &decoded.Animations); err != nil {
			return fmt.Errorf("field %q: %w", "animations", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "animations")
	}
	if raw, present := object["size"]; present {
		if err := (contract.Decode[StampSize])(raw, &decoded.Size); err != nil {
			return fmt.Errorf("field %q: %w", "size", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "size")
	}
	*value = StampEffects(decoded)
	return nil
}

type StampKind struct {
	Normal   *StampKindNormal
	User     *StampKindUser
	HexColor *StampKindHexColor
	HslColor *StampKindHslColor
}
type StampKindNormal struct {
	Name string `json:"name"`
}
type StampKindUser struct {
	Name string `json:"name"`
}
type StampKindHexColor struct {
	Rgb uint32 `json:"rgb"`
}
type StampKindHslColor struct {
	Hue        uint16  `json:"hue"`
	Lightness  float64 `json:"lightness"`
	Saturation float64 `json:"saturation"`
}

func (value *StampKind) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	var tag string
	if err := contract.Decode(object["type"], &tag); err != nil {
		return err
	}
	switch tag {
	case "normal":
		var decoded StampKindNormal
		if err := contract.Fields(object, "type", "name"); err != nil {
			return err
		}
		if raw, present := object["name"]; present {
			if err := (contract.Decode[string])(raw, &decoded.Name); err != nil {
				return fmt.Errorf("field %q: %w", "name", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "name")
		}
		*value = StampKind{Normal: &decoded}
		return nil
	case "user":
		var decoded StampKindUser
		if err := contract.Fields(object, "type", "name"); err != nil {
			return err
		}
		if raw, present := object["name"]; present {
			if err := (contract.Decode[string])(raw, &decoded.Name); err != nil {
				return fmt.Errorf("field %q: %w", "name", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "name")
		}
		*value = StampKind{User: &decoded}
		return nil
	case "hex_color":
		var decoded StampKindHexColor
		if err := contract.Fields(object, "type", "rgb"); err != nil {
			return err
		}
		if raw, present := object["rgb"]; present {
			if err := (func(raw json.RawMessage, value *uint32) error {
				if err := contract.Decode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 16777215 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})(raw, &decoded.Rgb); err != nil {
				return fmt.Errorf("field %q: %w", "rgb", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "rgb")
		}
		*value = StampKind{HexColor: &decoded}
		return nil
	case "hsl_color":
		var decoded StampKindHslColor
		if err := contract.Fields(object, "type", "hue", "lightness", "saturation"); err != nil {
			return err
		}
		if raw, present := object["hue"]; present {
			if err := (func(raw json.RawMessage, value *uint16) error {
				if err := contract.Decode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 359 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})(raw, &decoded.Hue); err != nil {
				return fmt.Errorf("field %q: %w", "hue", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "hue")
		}
		if raw, present := object["lightness"]; present {
			if err := (func(raw json.RawMessage, value *float64) error {
				if err := contract.Decode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 100 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})(raw, &decoded.Lightness); err != nil {
				return fmt.Errorf("field %q: %w", "lightness", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "lightness")
		}
		if raw, present := object["saturation"]; present {
			if err := (func(raw json.RawMessage, value *float64) error {
				if err := contract.Decode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 100 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})(raw, &decoded.Saturation); err != nil {
				return fmt.Errorf("field %q: %w", "saturation", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "saturation")
		}
		*value = StampKind{HslColor: &decoded}
		return nil
	}
	return fmt.Errorf("unknown union tag %q", tag)
}
func (value StampKind) MarshalJSON() ([]byte, error) {
	count := 0
	if value.Normal != nil {
		count++
	}
	if value.User != nil {
		count++
	}
	if value.HexColor != nil {
		count++
	}
	if value.HslColor != nil {
		count++
	}
	if count != 1 {
		return nil, fmt.Errorf("union requires exactly one variant")
	}
	var raw []byte
	var err error
	if value.Normal != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*StampKindNormal
		}{Type: "normal", StampKindNormal: value.Normal})
	}
	if value.User != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*StampKindUser
		}{Type: "user", StampKindUser: value.User})
	}
	if value.HexColor != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*StampKindHexColor
		}{Type: "hex_color", StampKindHexColor: value.HexColor})
	}
	if value.HslColor != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*StampKindHslColor
		}{Type: "hsl_color", StampKindHslColor: value.HslColor})
	}
	if err != nil {
		return nil, err
	}
	var checked StampKind
	if err := json.Unmarshal(raw, &checked); err != nil {
		return nil, err
	}
	return raw, nil
}

type StampSize string

const (
	StampSizeNone    StampSize = "none"
	StampSizeExLarge StampSize = "ex-large"
	StampSizeLarge   StampSize = "large"
	StampSizeSmall   StampSize = "small"
)

func (value *StampSize) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "none", "ex-large", "large", "small"); err != nil {
		return err
	}
	*value = StampSize(decoded)
	return nil
}
func (value StampSize) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "none", "ex-large", "large", "small"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

const BlankLineName = "traq.blank_line"

func (*BlankLine) NodePayload() {}
func (*BlankLine) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "leaf"}}
}

const EmbeddingName = "traq.embedding"

func (*Embedding) NodePayload() {}
func (*Embedding) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const ReferenceName = "traq.reference"

func (*Reference) NodePayload() {}
func (*Reference) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const SpoilerName = "traq.spoiler"

func (*Spoiler) NodePayload() {}
func (*Spoiler) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const StampName = "traq.stamp"

func (*Stamp) NodePayload() {}
func (*Stamp) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}
func NewPayload(kind string) ast.Payload {
	switch kind {
	case BlankLineName:
		return &BlankLine{}
	case EmbeddingName:
		return &Embedding{}
	case ReferenceName:
		return &Reference{}
	case SpoilerName:
		return &Spoiler{}
	case StampName:
		return &Stamp{}
	}
	return nil
}
