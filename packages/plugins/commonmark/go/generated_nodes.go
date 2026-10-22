// Code generated from Rust contracts. DO NOT EDIT.
package commonmark

import (
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
)

type Blockquote struct {
}

func (value *Blockquote) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Blockquote
	var decoded wire
	if err := contract.Fields(object); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire CodeBlock
	var decoded wire
	if err := contract.Fields(object, "fenced", "info", "literal"); err != nil {
		return err
	}
	if raw, present := object["fenced"]; present {
		if err := (contract.Decode[bool])(raw, &decoded.Fenced); err != nil {
			return fmt.Errorf("field %q: %w", "fenced", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "fenced")
	}
	if raw, present := object["info"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Info); err != nil {
			return fmt.Errorf("field %q: %w", "info", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "info")
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Emphasis
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Emphasis(decoded)
	return nil
}

type Hardbreak struct {
}

func (value *Hardbreak) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Hardbreak
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Hardbreak(decoded)
	return nil
}

type Heading struct {
	Level uint8 `json:"level"`
}

func (value *Heading) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Heading
	var decoded wire
	if err := contract.Fields(object, "level"); err != nil {
		return err
	}
	if raw, present := object["level"]; present {
		if err := (func(raw json.RawMessage, value *uint8) error {
			if err := contract.Decode(raw, value); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire HtmlBlock
	var decoded wire
	if err := contract.Fields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire HtmlInline
	var decoded wire
	if err := contract.Fields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Image
	var decoded wire
	if err := contract.Fields(object, "destination", "label_source", "title"); err != nil {
		return err
	}
	if raw, present := object["destination"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Destination); err != nil {
			return fmt.Errorf("field %q: %w", "destination", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "destination")
	}
	if raw, present := object["label_source"]; present {
		if err := (contract.Decode[string])(raw, &decoded.LabelSource); err != nil {
			return fmt.Errorf("field %q: %w", "label_source", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "label_source")
	}
	if raw, present := object["title"]; present {
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire InlineCode
	var decoded wire
	if err := contract.Fields(object, "literal"); err != nil {
		return err
	}
	if raw, present := object["literal"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Literal); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Link
	var decoded wire
	if err := contract.Fields(object, "destination", "form", "title"); err != nil {
		return err
	}
	if raw, present := object["destination"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Destination); err != nil {
			return fmt.Errorf("field %q: %w", "destination", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "destination")
	}
	if raw, present := object["form"]; present {
		if err := (contract.Decode[LinkForm])(raw, &decoded.Form); err != nil {
			return fmt.Errorf("field %q: %w", "form", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "form")
	}
	if raw, present := object["title"]; present {
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
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
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "explicit", "autolink", "linkify"); err != nil {
		return err
	}
	*value = LinkForm(decoded)
	return nil
}
func (value LinkForm) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "explicit", "autolink", "linkify"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type List struct {
	Kind  ListKind `json:"kind"`
	Tight bool     `json:"tight"`
}

func (value *List) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire List
	var decoded wire
	if err := contract.Fields(object, "kind", "tight"); err != nil {
		return err
	}
	if raw, present := object["kind"]; present {
		if err := (contract.Decode[ListKind])(raw, &decoded.Kind); err != nil {
			return fmt.Errorf("field %q: %w", "kind", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "kind")
	}
	if raw, present := object["tight"]; present {
		if err := (contract.Decode[bool])(raw, &decoded.Tight); err != nil {
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
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "-", "+", "*"); err != nil {
		return err
	}
	*value = BulletMarker(decoded)
	return nil
}
func (value BulletMarker) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "-", "+", "*"); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	var tag string
	if err := contract.Decode(object["type"], &tag); err != nil {
		return err
	}
	switch tag {
	case "ordered":
		var decoded ListKindOrdered
		if err := contract.Fields(object, "type", "delimiter", "start"); err != nil {
			return err
		}
		if raw, present := object["delimiter"]; present {
			if err := (contract.Decode[OrderedDelimiter])(raw, &decoded.Delimiter); err != nil {
				return fmt.Errorf("field %q: %w", "delimiter", err)
			}
		} else {
			return fmt.Errorf("missing required field %q", "delimiter")
		}
		if raw, present := object["start"]; present {
			if err := (func(raw json.RawMessage, value *uint32) error {
				if err := contract.Decode(raw, value); err != nil {
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
		if err := contract.Fields(object, "type", "marker"); err != nil {
			return err
		}
		if raw, present := object["marker"]; present {
			if err := (contract.Decode[BulletMarker])(raw, &decoded.Marker); err != nil {
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
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "period", "parenthesis"); err != nil {
		return err
	}
	*value = OrderedDelimiter(decoded)
	return nil
}
func (value OrderedDelimiter) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "period", "parenthesis"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ListItem struct {
}

func (value *ListItem) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ListItem
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = ListItem(decoded)
	return nil
}

type Paragraph struct {
}

func (value *Paragraph) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Paragraph
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Paragraph(decoded)
	return nil
}

type Softbreak struct {
}

func (value *Softbreak) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Softbreak
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Softbreak(decoded)
	return nil
}

type Strong struct {
}

func (value *Strong) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Strong
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Strong(decoded)
	return nil
}

type Text struct {
	Value string `json:"value"`
}

func (value *Text) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Text
	var decoded wire
	if err := contract.Fields(object, "value"); err != nil {
		return err
	}
	if raw, present := object["value"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Value); err != nil {
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
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ThematicBreak
	var decoded wire
	if err := contract.Fields(object, "marker"); err != nil {
		return err
	}
	if raw, present := object["marker"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Marker); err != nil {
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
