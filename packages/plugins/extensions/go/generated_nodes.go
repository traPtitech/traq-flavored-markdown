// Code generated from Rust contracts. DO NOT EDIT.
package generic

import (
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
)

type BlockMath struct {
	Tex string `json:"tex"`
}

func (value *BlockMath) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire BlockMath
	var decoded wire
	if err := contract.Fields(object, "tex"); err != nil {
		return err
	}
	if raw, present := object["tex"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Tex); err != nil {
			return fmt.Errorf("field %q: %w", "tex", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "tex")
	}
	*value = BlockMath(decoded)
	return nil
}

type Cell struct {
}

func (value *Cell) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Cell
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Cell(decoded)
	return nil
}

type InlineMath struct {
	Tex string `json:"tex"`
}

func (value *InlineMath) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire InlineMath
	var decoded wire
	if err := contract.Fields(object, "tex"); err != nil {
		return err
	}
	if raw, present := object["tex"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Tex); err != nil {
			return fmt.Errorf("field %q: %w", "tex", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "tex")
	}
	*value = InlineMath(decoded)
	return nil
}

type Mark struct {
}

func (value *Mark) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Mark
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Mark(decoded)
	return nil
}

type Row struct {
}

func (value *Row) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Row
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Row(decoded)
	return nil
}

type Strikethrough struct {
}

func (value *Strikethrough) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Strikethrough
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = Strikethrough(decoded)
	return nil
}

type Table struct {
	Alignments []*Alignment `json:"alignments"`
}

func (value *Table) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire Table
	var decoded wire
	if err := contract.Fields(object, "alignments"); err != nil {
		return err
	}
	if raw, present := object["alignments"]; present {
		if err := (func(raw json.RawMessage, value *[]*Alignment) error {
			if err := contract.Array(raw, value, func(raw json.RawMessage, value **Alignment) error {
				return contract.Nullable(raw, value, contract.Decode[Alignment])
			}); err != nil {
				return err
			}
			if len(*value) < 1 {
				return fmt.Errorf("array shorter than schema bound")
			}
			return nil
		})(raw, &decoded.Alignments); err != nil {
			return fmt.Errorf("field %q: %w", "alignments", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "alignments")
	}
	*value = Table(decoded)
	return nil
}

type Alignment string

const (
	AlignmentLeft   Alignment = "left"
	AlignmentCenter Alignment = "center"
	AlignmentRight  Alignment = "right"
)

func (value *Alignment) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "left", "center", "right"); err != nil {
		return err
	}
	*value = Alignment(decoded)
	return nil
}
func (value Alignment) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "left", "center", "right"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type HeaderRow struct {
}

func (value *HeaderRow) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire HeaderRow
	var decoded wire
	if err := contract.Fields(object); err != nil {
		return err
	}
	*value = HeaderRow(decoded)
	return nil
}

const BlockMathName = "generic.block_math"

func (*BlockMath) NodePayload() {}
func (*BlockMath) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "leaf"}}
}

const CellName = "generic.cell"

func (*Cell) NodePayload() {}
func (*Cell) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "structural", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const InlineMathName = "generic.inline_math"

func (*InlineMath) NodePayload() {}
func (*InlineMath) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "leaf"}}
}

const MarkName = "generic.mark"

func (*Mark) NodePayload() {}
func (*Mark) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const RowName = "generic.row"

func (*Row) NodePayload() {}
func (*Row) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "structural", Children: ast.ChildStructure{Kind: "types", Types: []string{"generic.cell"}, Nonempty: true}}
}

const StrikethroughName = "generic.strikethrough"

func (*Strikethrough) NodePayload() {}
func (*Strikethrough) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "inline", Children: ast.ChildStructure{Kind: "roles", Roles: []string{"inline"}, Nonempty: false}}
}

const TableName = "generic.table"

func (*Table) NodePayload() {}
func (*Table) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "block", Children: ast.ChildStructure{Kind: "sequence", Prefix: []string{"generic.table_header_row"}, Rest: "generic.row", HasArity: true}}
}
func (value *Table) ChildArity() int { return len(value.Alignments) }

const HeaderRowName = "generic.table_header_row"

func (*HeaderRow) NodePayload() {}
func (*HeaderRow) NodeStructure() ast.NodeStructure {
	return ast.NodeStructure{Role: "structural", Children: ast.ChildStructure{Kind: "types", Types: []string{"generic.cell"}, Nonempty: true}}
}
func NewPayload(kind string) ast.Payload {
	switch kind {
	case BlockMathName:
		return &BlockMath{}
	case CellName:
		return &Cell{}
	case InlineMathName:
		return &InlineMath{}
	case MarkName:
		return &Mark{}
	case RowName:
		return &Row{}
	case StrikethroughName:
		return &Strikethrough{}
	case TableName:
		return &Table{}
	case HeaderRowName:
		return &HeaderRow{}
	}
	return nil
}
