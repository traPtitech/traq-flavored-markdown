// Code generated from Rust contracts. DO NOT EDIT.
package generic

import "github.com/traq-markdown-parser/core/go/ast"

const MarkName = "markdown_generic_contracts::mark::MarkData"

type Mark struct {
}

func (*Mark) NodePayload() {}

const BlockMathName = "markdown_generic_contracts::math::BlockMathData"

type BlockMath struct {
	Tex string `json:"tex"`
}

func (*BlockMath) NodePayload() {}

const InlineMathName = "markdown_generic_contracts::math::InlineMathData"

type InlineMath struct {
	Tex string `json:"tex"`
}

func (*InlineMath) NodePayload() {}

const StrikethroughName = "markdown_generic_contracts::strikethrough::StrikethroughData"

type Strikethrough struct {
}

func (*Strikethrough) NodePayload() {}

const CellName = "markdown_generic_contracts::table::CellData"

type Cell struct {
	Alignment *string `json:"alignment"`
}

func (*Cell) NodePayload() {}

const RowName = "markdown_generic_contracts::table::RowData"

type Row struct {
	Header bool `json:"header"`
}

func (*Row) NodePayload() {}

const TableName = "markdown_generic_contracts::table::TableData"

type Table struct {
}

func (*Table) NodePayload() {}
func NewPayload(kind string) ast.Payload {
	switch kind {
	case MarkName:
		return &Mark{}
	case BlockMathName:
		return &BlockMath{}
	case InlineMathName:
		return &InlineMath{}
	case StrikethroughName:
		return &Strikethrough{}
	case CellName:
		return &Cell{}
	case RowName:
		return &Row{}
	case TableName:
		return &Table{}
	}
	return nil
}
