package ast

import (
	"slices"
)

// NodeStructure is generated from a native payload's structural contract.
type NodeStructure struct {
	Role     string
	Children ChildStructure
}
type ChildStructure struct {
	Kind     string
	Roles    []string
	Types    []string
	Nonempty bool
	Prefix   []string
	Rest     string
	HasArity bool
}
type StructuredPayload interface {
	Payload
	NodeStructure() NodeStructure
}

func validateStructure(node *MutableNode, path string) error {
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
	case "sequence":
		if len(node.Children) < len(policy.Prefix) {
			return invalidChildren()
		}
		arity := -1
		if policy.HasArity {
			counter, ok := node.Data.(interface{ ChildArity() int })
			if !ok {
				return invalidChildren()
			}
			arity = counter.ChildArity()
			if arity <= 0 {
				return invalidChildren()
			}
		}
		for index, child := range node.Children {
			expected := policy.Rest
			if index < len(policy.Prefix) {
				expected = policy.Prefix[index]
			}
			if child.Kind != expected || (policy.HasArity && len(child.Children) != arity) {
				return invalidChildren()
			}
		}
	default:
		return invalid(path+".data", "unknown node structural policy")
	}
	return nil
}
