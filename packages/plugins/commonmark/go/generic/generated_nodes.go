// Code generated from Rust contracts. DO NOT EDIT.
package generic

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

type Alignment string

const (
	AlignmentLeft   Alignment = "left"
	AlignmentCenter Alignment = "center"
	AlignmentRight  Alignment = "right"
)

func (value *Alignment) UnmarshalJSON(raw []byte) error {
	if err := contractEnum(raw, "left", "center", "right"); err != nil {
		return err
	}
	var decoded string
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Alignment(decoded)
	return nil
}
func (value Alignment) MarshalJSON() ([]byte, error) {
	raw, err := json.Marshal(string(value))
	if err != nil {
		return nil, err
	}
	if err := contractEnum(raw, "left", "center", "right"); err != nil {
		return nil, err
	}
	return raw, nil
}

const BlockMathName = "generic.block_math"

type BlockMath struct {
	Tex string `json:"tex"`
}

func (value *BlockMath) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"tex": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire BlockMath
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = BlockMath(decoded)
	return nil
}
func (*BlockMath) NodePayload() {}

const CellName = "generic.cell"

type Cell struct {
	Alignment *Alignment `json:"alignment"`
}

func (value *Cell) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"alignment": func(raw json.RawMessage) error {
			return contractNullable(raw, func(raw json.RawMessage) error { return contractEnum(raw, "left", "center", "right") })
		}}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Cell
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Cell(decoded)
	return nil
}
func (*Cell) NodePayload() {}

const InlineMathName = "generic.inline_math"

type InlineMath struct {
	Tex string `json:"tex"`
}

func (value *InlineMath) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"tex": contractString}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire InlineMath
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = InlineMath(decoded)
	return nil
}
func (*InlineMath) NodePayload() {}

const MarkName = "generic.mark"

type Mark struct {
}

func (value *Mark) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Mark
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Mark(decoded)
	return nil
}
func (*Mark) NodePayload() {}

const RowName = "generic.row"

type Row struct {
	Header bool `json:"header"`
}

func (value *Row) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{"header": contractBoolean}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Row
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Row(decoded)
	return nil
}
func (*Row) NodePayload() {}

const StrikethroughName = "generic.strikethrough"

type Strikethrough struct {
}

func (value *Strikethrough) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Strikethrough
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Strikethrough(decoded)
	return nil
}
func (*Strikethrough) NodePayload() {}

const TableName = "generic.table"

type Table struct {
}

func (value *Table) UnmarshalJSON(raw []byte) error {
	if err := (func(raw json.RawMessage) error {
		return contractObject(raw, map[string]contractCheck{}, map[string]contractCheck{})
	})(raw); err != nil {
		return err
	}
	type wire Table
	var decoded wire
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return err
	}
	*value = Table(decoded)
	return nil
}
func (*Table) NodePayload() {}
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
	}
	return nil
}
