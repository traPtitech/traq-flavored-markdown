// Code generated from Rust contracts. DO NOT EDIT.
package commonmark

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
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

type Blockquote struct {
}

func (value *Blockquote) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Blockquote
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Blockquote(decoded)
	return nil
}

type CodeBlock struct {
	Fenced  bool   `json:"fenced"`
	Info    string `json:"info"`
	Literal string `json:"literal"`
}

func (value *CodeBlock) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire CodeBlock
	var decoded wire
	if err := contractFields(object, "fenced", "info", "literal"); err != nil {
		return err
	}
	if raw, present := object["fenced"]; present {
		if err := (contractDecode[bool])(raw, &decoded.Fenced); err != nil {
			return fmt.Errorf("field %q: %w", "fenced", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "fenced")
	}
	if raw, present := object["info"]; present {
		if err := (contractDecode[string])(raw, &decoded.Info); err != nil {
			return fmt.Errorf("field %q: %w", "info", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "info")
	}
	if raw, present := object["literal"]; present {
		if err := (contractDecode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	*value = CodeBlock(decoded)
	return nil
}

type Emphasis struct {
}

func (value *Emphasis) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Emphasis
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Emphasis(decoded)
	return nil
}

type Hardbreak struct {
}

func (value *Hardbreak) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Hardbreak
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Hardbreak(decoded)
	return nil
}

type Heading struct {
	Level uint8 `json:"level"`
}

func (value *Heading) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Heading
	var decoded wire
	if err := contractFields(object, "level"); err != nil {
		return err
	}
	if raw, present := object["level"]; present {
		if err := (func(raw json.RawMessage, value *uint8) error {
			if err := contractDecode(raw, value); err != nil {
				return err
			}
			if *value < 1 || *value > 6 {
				return fmt.Errorf("number outside schema range")
			}
			return nil
		})(raw, &decoded.Level); err != nil {
			return fmt.Errorf("field %q: %w", "level", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "level")
	}
	*value = Heading(decoded)
	return nil
}

type HtmlBlock struct {
	Literal string `json:"literal"`
}

func (value *HtmlBlock) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire HtmlBlock
	var decoded wire
	if err := contractFields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contractDecode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	*value = HtmlBlock(decoded)
	return nil
}

type HtmlInline struct {
	Literal string `json:"literal"`
}

func (value *HtmlInline) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire HtmlInline
	var decoded wire
	if err := contractFields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contractDecode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	*value = HtmlInline(decoded)
	return nil
}

type Image struct {
	Destination string  `json:"destination"`
	LabelSource string  `json:"label_source"`
	Title       *string `json:"title"`
}

func (value *Image) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Image
	var decoded wire
	if err := contractFields(object, "destination", "label_source", "title"); err != nil {
		return err
	}
	if raw, present := object["destination"]; present {
		if err := (contractDecode[string])(raw, &decoded.Destination); err != nil {
			return fmt.Errorf("field %q: %w", "destination", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "destination")
	}
	if raw, present := object["label_source"]; present {
		if err := (contractDecode[string])(raw, &decoded.LabelSource); err != nil {
			return fmt.Errorf("field %q: %w", "label_source", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "label_source")
	}
	if raw, present := object["title"]; present {
		if err := (func(raw json.RawMessage, value **string) error {
			return contractNullable(raw, value, contractDecode[string])
		})(raw, &decoded.Title); err != nil {
			return fmt.Errorf("field %q: %w", "title", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "title")
	}
	*value = Image(decoded)
	return nil
}

type InlineCode struct {
	Literal string `json:"literal"`
}

func (value *InlineCode) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire InlineCode
	var decoded wire
	if err := contractFields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contractDecode[string])(raw, &decoded.Literal); err != nil {
			return fmt.Errorf("field %q: %w", "literal", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "literal")
	}
	*value = InlineCode(decoded)
	return nil
}

type Link struct {
	Destination string   `json:"destination"`
	Form        LinkForm `json:"form"`
	Title       *string  `json:"title"`
}

func (value *Link) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Link
	var decoded wire
	if err := contractFields(object, "destination", "form", "title"); err != nil {
		return err
	}
	if raw, present := object["destination"]; present {
		if err := (contractDecode[string])(raw, &decoded.Destination); err != nil {
			return fmt.Errorf("field %q: %w", "destination", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "destination")
	}
	if raw, present := object["form"]; present {
		if err := (contractDecode[LinkForm])(raw, &decoded.Form); err != nil {
			return fmt.Errorf("field %q: %w", "form", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "form")
	}
	if raw, present := object["title"]; present {
		if err := (func(raw json.RawMessage, value **string) error {
			return contractNullable(raw, value, contractDecode[string])
		})(raw, &decoded.Title); err != nil {
			return fmt.Errorf("field %q: %w", "title", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "title")
	}
	*value = Link(decoded)
	return nil
}

type LinkForm string

const (
	LinkFormExplicit LinkForm = "explicit"
	LinkFormAutolink LinkForm = "autolink"
	LinkFormLinkify  LinkForm = "linkify"
)

func (value *LinkForm) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "explicit", "autolink", "linkify"); err != nil {
		return err
	}
	*value = LinkForm(decoded)
	return nil
}
func (value LinkForm) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "explicit", "autolink", "linkify"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type List struct {
	Kind  ListKind `json:"kind"`
	Tight bool     `json:"tight"`
}

func (value *List) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire List
	var decoded wire
	if err := contractFields(object, "kind", "tight"); err != nil {
		return err
	}
	if raw, present := object["kind"]; present {
		if err := (contractDecode[ListKind])(raw, &decoded.Kind); err != nil {
			return fmt.Errorf("field %q: %w", "kind", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "kind")
	}
	if raw, present := object["tight"]; present {
		if err := (contractDecode[bool])(raw, &decoded.Tight); err != nil {
			return fmt.Errorf("field %q: %w", "tight", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "tight")
	}
	*value = List(decoded)
	return nil
}

type BulletMarker string

const (
	BulletMarkerDash     BulletMarker = "-"
	BulletMarkerPlus     BulletMarker = "+"
	BulletMarkerAsterisk BulletMarker = "*"
)

func (value *BulletMarker) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "-", "+", "*"); err != nil {
		return err
	}
	*value = BulletMarker(decoded)
	return nil
}
func (value BulletMarker) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "-", "+", "*"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ListKind struct {
	Ordered *ListKindOrdered
	Bullet  *ListKindBullet
}
type ListKindOrdered struct {
	Delimiter OrderedDelimiter `json:"delimiter"`
	Start     uint32           `json:"start"`
}
type ListKindBullet struct {
	Marker BulletMarker `json:"marker"`
}

func (value *ListKind) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	var tag string
	if err := contractDecode(object["type"], &tag); err != nil {
		return err
	}
	switch tag {
	case "ordered":
		var decoded ListKindOrdered
		if err := contractFields(object, "type", "delimiter", "start"); err != nil {
			return err
		}
		if raw, present := object["delimiter"]; present {
			if err := (contractDecode[OrderedDelimiter])(raw, &decoded.Delimiter); err != nil {
				return fmt.Errorf("field %q: %w", "delimiter", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "delimiter")
		}
		if raw, present := object["start"]; present {
			if err := (func(raw json.RawMessage, value *uint32) error {
				if err := contractDecode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 999999999 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})(raw, &decoded.Start); err != nil {
				return fmt.Errorf("field %q: %w", "start", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "start")
		}
		*value = ListKind{Ordered: &decoded}
		return nil
	case "bullet":
		var decoded ListKindBullet
		if err := contractFields(object, "type", "marker"); err != nil {
			return err
		}
		if raw, present := object["marker"]; present {
			if err := (contractDecode[BulletMarker])(raw, &decoded.Marker); err != nil {
				return fmt.Errorf("field %q: %w", "marker", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "marker")
		}
		*value = ListKind{Bullet: &decoded}
		return nil
	}
	return fmt.Errorf("unknown union tag %q", tag)
}
func (value ListKind) MarshalJSON() ([]byte, error) {
	count := 0
	if value.Ordered != nil {
		count++
	}
	if value.Bullet != nil {
		count++
	}
	if count != 1 {
		return nil, fmt.Errorf("union requires exactly one variant")
	}
	var raw []byte
	var err error
	if value.Ordered != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*ListKindOrdered
		}{Type: "ordered", ListKindOrdered: value.Ordered})
	}
	if value.Bullet != nil {
		raw, err = json.Marshal(struct {
			Type string `json:"type"`
			*ListKindBullet
		}{Type: "bullet", ListKindBullet: value.Bullet})
	}
	if err != nil {
		return nil, err
	}
	var checked ListKind
	if err := json.Unmarshal(raw, &checked); err != nil {
		return nil, err
	}
	return raw, nil
}

type OrderedDelimiter string

const (
	OrderedDelimiterPeriod      OrderedDelimiter = "period"
	OrderedDelimiterParenthesis OrderedDelimiter = "parenthesis"
)

func (value *OrderedDelimiter) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "period", "parenthesis"); err != nil {
		return err
	}
	*value = OrderedDelimiter(decoded)
	return nil
}
func (value OrderedDelimiter) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "period", "parenthesis"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ListItem struct {
}

func (value *ListItem) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire ListItem
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = ListItem(decoded)
	return nil
}

type Paragraph struct {
}

func (value *Paragraph) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Paragraph
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Paragraph(decoded)
	return nil
}

type Softbreak struct {
}

func (value *Softbreak) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Softbreak
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Softbreak(decoded)
	return nil
}

type Strong struct {
}

func (value *Strong) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Strong
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Strong(decoded)
	return nil
}

type Text struct {
	Value string `json:"value"`
}

func (value *Text) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Text
	var decoded wire
	if err := contractFields(object, "value"); err != nil {
		return err
	}
	if raw, present := object["value"]; present {
		if err := (contractDecode[string])(raw, &decoded.Value); err != nil {
			return fmt.Errorf("field %q: %w", "value", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "value")
	}
	*value = Text(decoded)
	return nil
}

type ThematicBreak struct {
	Marker string `json:"marker"`
}

func (value *ThematicBreak) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire ThematicBreak
	var decoded wire
	if err := contractFields(object, "marker"); err != nil {
		return err
	}
	if raw, present := object["marker"]; present {
		if err := (contractDecode[string])(raw, &decoded.Marker); err != nil {
			return fmt.Errorf("field %q: %w", "marker", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "marker")
	}
	*value = ThematicBreak(decoded)
	return nil
}

const BlockquoteName = "commonmark.blockquote"

func (*Blockquote) NodePayload() {}
func (*Blockquote) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"block"}, Nonempty: false}}
}

const CodeBlockName = "commonmark.code_block"

func (*CodeBlock) NodePayload() {}
func (*CodeBlock) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "leaf"}}
}

const EmphasisName = "commonmark.emphasis"

func (*Emphasis) NodePayload() {}
func (*Emphasis) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const HardbreakName = "commonmark.hardbreak"

func (*Hardbreak) NodePayload() {}
func (*Hardbreak) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const HeadingName = "commonmark.heading"

func (*Heading) NodePayload() {}
func (*Heading) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const HtmlBlockName = "commonmark.html_block"

func (*HtmlBlock) NodePayload() {}
func (*HtmlBlock) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "leaf"}}
}

const HtmlInlineName = "commonmark.html_inline"

func (*HtmlInline) NodePayload() {}
func (*HtmlInline) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const ImageName = "commonmark.image"

func (*Image) NodePayload() {}
func (*Image) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const InlineCodeName = "commonmark.inline_code"

func (*InlineCode) NodePayload() {}
func (*InlineCode) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const LinkName = "commonmark.link"

func (*Link) NodePayload() {}
func (*Link) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const ListName = "commonmark.list"

func (*List) NodePayload() {}
func (*List) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "types", Types: []string{"commonmark.list_item"}, Nonempty: true}}
}

const ListItemName = "commonmark.list_item"

func (*ListItem) NodePayload() {}
func (*ListItem) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "structural", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"block"}, Nonempty: false}}
}

const ParagraphName = "commonmark.paragraph"

func (*Paragraph) NodePayload() {}
func (*Paragraph) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const SoftbreakName = "commonmark.softbreak"

func (*Softbreak) NodePayload() {}
func (*Softbreak) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const StrongName = "commonmark.strong"

func (*Strong) NodePayload() {}
func (*Strong) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const TextName = "commonmark.text"

func (*Text) NodePayload() {}
func (*Text) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const ThematicBreakName = "commonmark.thematic_break"

func (*ThematicBreak) NodePayload() {}
func (*ThematicBreak) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "leaf"}}
}
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
