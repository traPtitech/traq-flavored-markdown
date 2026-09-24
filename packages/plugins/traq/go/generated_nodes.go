// Code generated from Rust contracts. DO NOT EDIT.
package trap

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
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

type EmbeddingKind string

const (
	EmbeddingKindFile    EmbeddingKind = "file"
	EmbeddingKindMessage EmbeddingKind = "message"
)

func (value *EmbeddingKind) UnmarshalJSON(raw []byte) error {
	if err := contractEnum(raw, "file", "message"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = EmbeddingKind(decoded)
	return nil
}
func (value EmbeddingKind) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "file", "message"); err != nil {
		return nil, err
	}
	return raw, nil
}

type ReferenceKind string

const (
	ReferenceKindUser    ReferenceKind = "user"
	ReferenceKindGroup   ReferenceKind = "group"
	ReferenceKindChannel ReferenceKind = "channel"
)

func (value *ReferenceKind) UnmarshalJSON(raw []byte) error {
	if err := contractEnum(raw, "user", "group", "channel"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = ReferenceKind(decoded)
	return nil
}
func (value ReferenceKind) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "user", "group", "channel"); err != nil {
		return nil, err
	}
	return raw, nil
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
	if err := contractEnum(raw, "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = StampAnimation(decoded)
	return nil
}
func (value StampAnimation) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract"); err != nil {
		return nil, err
	}
	return raw, nil
}

type StampEffects struct {
	Animations []StampAnimation `json:"animations"`
	Size       StampSize        `json:"size"`
}

func (value *StampEffects) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"animations": func(raw json.RawMessage) error {
			return contractArray(raw, func(raw json.RawMessage) error {
				return contractEnum(raw, "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract")
			})
		}, "size": func(raw json.RawMessage) error { return contractEnum(raw, "none", "ex-large", "large", "small") }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire StampEffects
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
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
	Name string `json:"name"`
	Rgb  uint32 `json:"rgb"`
}

type StampKindHslColor struct {
	Hue        string `json:"hue"`
	Lightness  string `json:"lightness"`
	Name       string `json:"name"`
	Saturation string `json:"saturation"`
}

func (value *StampKind) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractUnion(raw, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "normal") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "user") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "rgb": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hex_color") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"hue": contractString, "lightness": contractString, "name": contractString, "saturation": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hsl_color") }}, map[string]contractCheck{})
		})
	})(raw); err != nil {
		return err
	}
	var tag struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &tag); err != nil {
		return err
	}
	switch tag.Type {
	case "normal":
		var decoded StampKindNormal
		if err := json.Unmarshal(raw, &decoded); err != nil {
			return err
		}
		*value = StampKind{Normal: &decoded}
		return nil
	case "user":
		var decoded StampKindUser
		if err := json.Unmarshal(raw, &decoded); err != nil {
			return err
		}
		*value = StampKind{User: &decoded}
		return nil
	case "hex_color":
		var decoded StampKindHexColor
		if err := json.Unmarshal(raw, &decoded); err != nil {
			return err
		}
		*value = StampKind{HexColor: &decoded}
		return nil
	case "hsl_color":
		var decoded StampKindHslColor
		if err := json.Unmarshal(raw, &decoded); err != nil {
			return err
		}
		*value = StampKind{HslColor: &decoded}
		return nil
	}
	return fmt.Errorf("unknown union tag %q", tag.Type)
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
	if err := (func(raw json.RawMessage) error {
		return contractUnion(raw, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "normal") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "user") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"name": contractString, "rgb": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hex_color") }}, map[string]contractCheck{})
		}, func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"hue": contractString, "lightness": contractString, "name": contractString, "saturation": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hsl_color") }}, map[string]contractCheck{})
		})
	})(raw); err != nil {
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
	if err := contractEnum(raw, "none", "ex-large", "large", "small"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = StampSize(decoded)
	return nil
}
func (value StampSize) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "none", "ex-large", "large", "small"); err != nil {
		return nil, err
	}
	return raw, nil
}

const BlankLineName = "traq.blank_line"

type BlankLine struct {
}

func (value *BlankLine) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire BlankLine
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = BlankLine(decoded)
	return nil
}
func (*BlankLine) NodePayload() {}

const EmbeddingName = "traq.embedding"

type Embedding struct {
	ID      string        `json:"id"`
	Label   string        `json:"label"`
	Literal string        `json:"literal"`
	Type    EmbeddingKind `json:"type"`
}

func (value *Embedding) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"id": contractString, "label": contractString, "literal": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "file", "message") }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Embedding
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Embedding(decoded)
	return nil
}
func (*Embedding) NodePayload() {}

const ReferenceName = "traq.reference"

type Reference struct {
	ID    string        `json:"id"`
	Label string        `json:"label"`
	Type  ReferenceKind `json:"type"`
}

func (value *Reference) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"id": contractString, "label": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "user", "group", "channel") }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Reference
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Reference(decoded)
	return nil
}
func (*Reference) NodePayload() {}

const SpoilerName = "traq.spoiler"

type Spoiler struct {
}

func (value *Spoiler) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Spoiler
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Spoiler(decoded)
	return nil
}
func (*Spoiler) NodePayload() {}

const StampName = "traq.stamp"

type Stamp struct {
	Effects StampEffects `json:"effects"`
	Kind    StampKind    `json:"kind"`
	Literal string       `json:"literal"`
}

func (value *Stamp) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"effects": func(raw json.RawMessage) error {
			return contractObject(raw, map[string]contractCheck{"animations": func(raw json.RawMessage) error {
				return contractArray(raw, func(raw json.RawMessage) error {
					return contractEnum(raw, "rotate", "rotate-inv", "wiggle", "parrot", "zoom", "inversion", "turn", "turn-v", "happa", "pyon", "flashy", "pull", "atsumori", "stretch", "stretch-v", "conga", "conga-inv", "rainbow", "ascension", "shake", "party", "attract")
				})
			}, "size": func(raw json.RawMessage) error { return contractEnum(raw, "none", "ex-large", "large", "small") }}, map[string]contractCheck{})
		}, "kind": func(raw json.RawMessage) error {
			return contractUnion(raw, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "normal") }}, map[string]contractCheck{})
			}, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"name": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "user") }}, map[string]contractCheck{})
			}, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"name": contractString, "rgb": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hex_color") }}, map[string]contractCheck{})
			}, func(raw json.RawMessage) error {
				return contractObject(raw, map[string]contractCheck{"hue": contractString, "lightness": contractString, "name": contractString, "saturation": contractString, "type": func(raw json.RawMessage) error { return contractEnum(raw, "hsl_color") }}, map[string]contractCheck{})
			})
		}, "literal": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Stamp
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Stamp(decoded)
	return nil
}
func (*Stamp) NodePayload() {}
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
