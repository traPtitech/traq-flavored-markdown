// Code generated from Rust contracts. DO NOT EDIT.
package commonmark

import "github.com/traq-markdown-parser/core/go/ast"

const BlockquoteName = "markdown_commonmark_contracts::nodes::Blockquote"

type Blockquote struct {
}

func (*Blockquote) NodePayload() {}

const CodeBlockName = "markdown_commonmark_contracts::nodes::CodeBlock"

type CodeBlock struct {
	Fenced  bool   `json:"fenced"`
	Info    string `json:"info"`
	Literal string `json:"literal"`
}

func (*CodeBlock) NodePayload() {}

const EmphasisName = "markdown_commonmark_contracts::nodes::Emphasis"

type Emphasis struct {
}

func (*Emphasis) NodePayload() {}

const HardbreakName = "markdown_commonmark_contracts::nodes::Hardbreak"

type Hardbreak struct {
}

func (*Hardbreak) NodePayload() {}

const HeadingName = "markdown_commonmark_contracts::nodes::Heading"

type Heading struct {
	Level uint8 `json:"level"`
}

func (*Heading) NodePayload() {}

const HtmlBlockName = "markdown_commonmark_contracts::nodes::HtmlBlock"

type HtmlBlock struct {
	Literal string `json:"literal"`
}

func (*HtmlBlock) NodePayload() {}

const HtmlInlineName = "markdown_commonmark_contracts::nodes::HtmlInline"

type HtmlInline struct {
	Literal string `json:"literal"`
}

func (*HtmlInline) NodePayload() {}

const ImageName = "markdown_commonmark_contracts::nodes::Image"

type Image struct {
	Destination string  `json:"destination"`
	LabelSource string  `json:"label_source"`
	Title       *string `json:"title"`
}

func (*Image) NodePayload() {}

const InlineCodeName = "markdown_commonmark_contracts::nodes::InlineCode"

type InlineCode struct {
	Literal string `json:"literal"`
}

func (*InlineCode) NodePayload() {}

const LinkName = "markdown_commonmark_contracts::nodes::Link"

type Link struct {
	Destination string  `json:"destination"`
	Form        string  `json:"form"`
	Title       *string `json:"title"`
}

func (*Link) NodePayload() {}

const ListName = "markdown_commonmark_contracts::nodes::List"

type List struct {
	Ordered bool   `json:"ordered"`
	Start   uint32 `json:"start"`
	Tight   bool   `json:"tight"`
}

func (*List) NodePayload() {}

const ListItemName = "markdown_commonmark_contracts::nodes::ListItem"

type ListItem struct {
	Marker string `json:"marker"`
}

func (*ListItem) NodePayload() {}

const ParagraphName = "markdown_commonmark_contracts::nodes::Paragraph"

type Paragraph struct {
}

func (*Paragraph) NodePayload() {}

const SoftbreakName = "markdown_commonmark_contracts::nodes::Softbreak"

type Softbreak struct {
}

func (*Softbreak) NodePayload() {}

const StrongName = "markdown_commonmark_contracts::nodes::Strong"

type Strong struct {
}

func (*Strong) NodePayload() {}

const TextName = "markdown_commonmark_contracts::nodes::Text"

type Text struct {
	Value string `json:"value"`
}

func (*Text) NodePayload() {}

const ThematicBreakName = "markdown_commonmark_contracts::nodes::ThematicBreak"

type ThematicBreak struct {
	Marker string `json:"marker"`
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
