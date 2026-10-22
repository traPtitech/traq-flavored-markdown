// Code generated from Rust contracts. DO NOT EDIT.
package generic

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

type BlockMath struct {
	Tex string `json:"tex"`
}

func (value *BlockMath) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire BlockMath
	var decoded wire
	if err := contractFields(object, "tex"); err != nil {
		return err
	}
	if raw, present := object["tex"]; present {
		if err := (contractDecode[string])(raw, &decoded.Tex); err != nil {
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
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Cell
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Cell(decoded)
	return nil
}

type InlineMath struct {
	Tex string `json:"tex"`
}

func (value *InlineMath) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire InlineMath
	var decoded wire
	if err := contractFields(object, "tex"); err != nil {
		return err
	}
	if raw, present := object["tex"]; present {
		if err := (contractDecode[string])(raw, &decoded.Tex); err != nil {
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
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Mark
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Mark(decoded)
	return nil
}

type Row struct {
}

func (value *Row) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Row
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Row(decoded)
	return nil
}

type Strikethrough struct {
}

func (value *Strikethrough) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Strikethrough
	var decoded wire
	if err := contractFields(object); err != nil {
		return err
	}
	*value = Strikethrough(decoded)
	return nil
}

type Table struct {
	Alignments []*Alignment `json:"alignments"`
}

func (value *Table) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire Table
	var decoded wire
	if err := contractFields(object, "alignments"); err != nil {
		return err
	}
	if raw, present := object["alignments"]; present {
		if err := (func(raw json.RawMessage, value *[]*Alignment) error {
			if err := contractArray(raw, value, func(raw json.RawMessage, value **Alignment) error {
				return contractNullable(raw, value, contractDecode[Alignment])
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
	if err := contractDecode(raw, &decoded); err != nil {
		return err
	}
	if err := contractEnum(decoded, "left", "center", "right"); err != nil {
		return err
	}
	*value = Alignment(decoded)
	return nil
}
func (value Alignment) MarshalJSON() ([]byte, error) {
	if err := contractEnum(string(value), "left", "center", "right"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type HeaderRow struct {
}

func (value *HeaderRow) UnmarshalJSON(raw []byte) error {
	object, err := contractObject(raw)
	if err != nil {
		return err
	}
	type wire HeaderRow
	var decoded wire
	if err := contractFields(object); err != nil {
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
