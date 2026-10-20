package ast

import (
	"reflect"
	"slices"
	"strings"
)

// NodeStructure is generated from a native payload's structural contract.
type NodeStructure struct {
	Role     string
	Children ChildStructure
}
type ChildStructure struct {
	Kind         string
	Roles        []string
	Types        []string
	Nonempty     bool
	Header       string
	Row          string
	ColumnsField string
}
type StructuredPayload interface {
	Payload
	NodeStructure() NodeStructure
}

func validateStructure(node *Node, path string) error {
	payload, known := node.Data.(StructuredPayload)
	if !known {
		return nil
	}
	policy := payload.NodeStructure().Children
	invalidChildren := func() error {
		return &ValidationError{Path: path + ".children", Span: &node.Span, Message: "children do not match the node structural contract"}
	}
	if policy.Nonempty && len(node.Children) == 0 {
		return invalidChildren()
	}
	switch policy.Kind {
	case "any":
		return nil
	case "leaf":
		if len(node.Children) != 0 {
			return invalidChildren()
		}
	case "roles":
		for _, child := range node.Children {
			role := "opaque"
			if metadata, known := child.Data.(StructuredPayload); known {
				role = metadata.NodeStructure().Role
			}
			if !slices.Contains(policy.Roles, role) {
				return invalidChildren()
			}
		}
	case "types":
		for _, child := range node.Children {
			if !slices.Contains(policy.Types, child.Kind) {
				return invalidChildren()
			}
		}
	case "table":
		columns, valid := columnCount(node.Data, policy.ColumnsField)
		if !valid || columns == 0 || len(node.Children) == 0 {
			return invalidChildren()
		}
		for index, child := range node.Children {
			expected := policy.Row
			if index == 0 {
				expected = policy.Header
			}
			if child.Kind != expected || len(child.Children) != columns {
				return invalidChildren()
			}
		}
	default:
		return invalid(path+".data", "unknown node structural policy")
	}
	return nil
}

func columnCount(payload Payload, fieldName string) (int, bool) {
	value := reflect.ValueOf(payload)
	for value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return 0, false
		}
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return 0, false
	}
	for index := 0; index < value.NumField(); index++ {
		field := value.Type().Field(index)
		if strings.Split(field.Tag.Get("json"), ",")[0] != fieldName {
			continue
		}
		column := value.Field(index)
		if column.Kind() != reflect.Slice && column.Kind() != reflect.Array {
			return 0, false
		}
		return column.Len(), true
	}
	return 0, false
}
