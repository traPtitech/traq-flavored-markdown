// Code generated from Rust contracts. DO NOT EDIT.
package commonmark

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

type LinkForm string

const (
	LinkFormExplicit LinkForm = "explicit"
	LinkFormAutolink LinkForm = "autolink"
	LinkFormLinkify  LinkForm = "linkify"
)

func (value *LinkForm) UnmarshalJSON(raw []byte) error {
	if err := contractEnum(raw, "explicit", "autolink", "linkify"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = LinkForm(decoded)
	return nil
}
func (value LinkForm) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "explicit", "autolink", "linkify"); err != nil {
		return nil, err
	}
	return raw, nil
}

const BlockquoteName = "commonmark.blockquote"

type Blockquote struct {
}

func (value *Blockquote) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Blockquote
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Blockquote(decoded)
	return nil
}
func (*Blockquote) NodePayload() {}

const CodeBlockName = "commonmark.code_block"

type CodeBlock struct {
	Fenced  bool   `json:"fenced"`
	Info    string `json:"info"`
	Literal string `json:"literal"`
}

func (value *CodeBlock) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"fenced": contractBoolean, "info": contractString, "literal": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire CodeBlock
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = CodeBlock(decoded)
	return nil
}
func (*CodeBlock) NodePayload() {}

const EmphasisName = "commonmark.emphasis"

type Emphasis struct {
}

func (value *Emphasis) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Emphasis
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Emphasis(decoded)
	return nil
}
func (*Emphasis) NodePayload() {}

const HardbreakName = "commonmark.hardbreak"

type Hardbreak struct {
}

func (value *Hardbreak) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Hardbreak
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Hardbreak(decoded)
	return nil
}
func (*Hardbreak) NodePayload() {}

const HeadingName = "commonmark.heading"

type Heading struct {
	Level uint8 `json:"level"`
}

func (value *Heading) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"level": func(raw json.RawMessage) error { return contractInteger(raw, 0, 255) }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Heading
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Heading(decoded)
	return nil
}
func (*Heading) NodePayload() {}

const HtmlBlockName = "commonmark.html_block"

type HtmlBlock struct {
	Literal string `json:"literal"`
}

func (value *HtmlBlock) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"literal": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire HtmlBlock
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = HtmlBlock(decoded)
	return nil
}
func (*HtmlBlock) NodePayload() {}

const HtmlInlineName = "commonmark.html_inline"

type HtmlInline struct {
	Literal string `json:"literal"`
}

func (value *HtmlInline) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"literal": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire HtmlInline
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = HtmlInline(decoded)
	return nil
}
func (*HtmlInline) NodePayload() {}

const ImageName = "commonmark.image"

type Image struct {
	Destination string  `json:"destination"`
	LabelSource string  `json:"label_source"`
	Title       *string `json:"title"`
}

func (value *Image) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"destination": contractString, "label_source": contractString, "title": func(raw json.RawMessage) error { return contractNullable(raw, contractString) }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Image
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Image(decoded)
	return nil
}
func (*Image) NodePayload() {}

const InlineCodeName = "commonmark.inline_code"

type InlineCode struct {
	Literal string `json:"literal"`
}

func (value *InlineCode) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"literal": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire InlineCode
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = InlineCode(decoded)
	return nil
}
func (*InlineCode) NodePayload() {}

const LinkName = "commonmark.link"

type Link struct {
	Destination string   `json:"destination"`
	Form        LinkForm `json:"form"`
	Title       *string  `json:"title"`
}

func (value *Link) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"destination": contractString, "form": func(raw json.RawMessage) error { return contractEnum(raw, "explicit", "autolink", "linkify") }, "title": func(raw json.RawMessage) error { return contractNullable(raw, contractString) }}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Link
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Link(decoded)
	return nil
}
func (*Link) NodePayload() {}

const ListName = "commonmark.list"

type List struct {
	Ordered bool   `json:"ordered"`
	Start   uint32 `json:"start"`
	Tight   bool   `json:"tight"`
}

func (value *List) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"ordered": contractBoolean, "start": func(raw json.RawMessage) error { return contractInteger(raw, 0, 4294967295) }, "tight": contractBoolean}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire List
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = List(decoded)
	return nil
}
func (*List) NodePayload() {}

const ListItemName = "commonmark.list_item"

type ListItem struct {
	Marker string `json:"marker"`
}

func (value *ListItem) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"marker": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire ListItem
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = ListItem(decoded)
	return nil
}
func (*ListItem) NodePayload() {}

const ParagraphName = "commonmark.paragraph"

type Paragraph struct {
}

func (value *Paragraph) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Paragraph
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Paragraph(decoded)
	return nil
}
func (*Paragraph) NodePayload() {}

const SoftbreakName = "commonmark.softbreak"

type Softbreak struct {
}

func (value *Softbreak) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Softbreak
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Softbreak(decoded)
	return nil
}
func (*Softbreak) NodePayload() {}

const StrongName = "commonmark.strong"

type Strong struct {
}

func (value *Strong) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Strong
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Strong(decoded)
	return nil
}
func (*Strong) NodePayload() {}

const TextName = "commonmark.text"

type Text struct {
	Value string `json:"value"`
}

func (value *Text) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"value": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Text
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Text(decoded)
	return nil
}
func (*Text) NodePayload() {}

const ThematicBreakName = "commonmark.thematic_break"

type ThematicBreak struct {
	Marker string `json:"marker"`
}

func (value *ThematicBreak) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"marker": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire ThematicBreak
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = ThematicBreak(decoded)
	return nil
}
func (*ThematicBreak) NodePayload() {}
func NewPayload(kind string) ast.Payload {
	switch kind {
	case BlockquoteName:
		return &Blockquote{}
	case CodeBlockName:
		return &CodeBlock{}
	case EmphasisName:
		return &Emphasis{}
	case HardbreakName:
		return &Hardbreak{}
	case HeadingName:
		return &Heading{}
	case HtmlBlockName:
		return &HtmlBlock{}
	case HtmlInlineName:
		return &HtmlInline{}
	case ImageName:
		return &Image{}
	case InlineCodeName:
		return &InlineCode{}
	case LinkName:
		return &Link{}
	case ListName:
		return &List{}
	case ListItemName:
		return &ListItem{}
	case ParagraphName:
		return &Paragraph{}
	case SoftbreakName:
		return &Softbreak{}
	case StrongName:
		return &Strong{}
	case TextName:
		return &Text{}
	case ThematicBreakName:
		return &ThematicBreak{}
	}
	return nil
}
