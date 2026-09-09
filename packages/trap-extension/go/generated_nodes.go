// Code generated from Rust contracts. DO NOT EDIT.
package trap

import "github.com/traq-markdown-parser/core/go/ast"

const BlankLineName = "markdown_trap_contracts::compat::BlankLineData"

type BlankLine struct {
}

func (*BlankLine) NodePayload() {}

const EmbeddingName = "markdown_trap_contracts::embedding::EmbeddingData"

type Embedding struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Literal string `json:"literal"`
	Type    string `json:"type"`
}

func (*Embedding) NodePayload() {}

const ReferenceName = "markdown_trap_contracts::reference::ReferenceData"

type Reference struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Type  string `json:"type"`
}

func (*Reference) NodePayload() {}

const SpoilerName = "markdown_trap_contracts::spoiler::SpoilerData"

type Spoiler struct {
}

func (*Spoiler) NodePayload() {}

const StampName = "markdown_trap_contracts::stamp::StampData"

type Stamp struct {
	Literal string `json:"literal"`
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
