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

type nodeShape struct {
	kind     string
	role     string
	children int
}

func shapeOf(kind string, payload Payload, childCount int) nodeShape {
	role := "opaque"
	if metadata, ok := payload.(StructuredPayload); ok {
		role = metadata.NodeStructure().Role
	}

	return nodeShape{kind: kind, role: role, children: childCount}
}

func validateStructure(node *MutableNode, path string) error {
	children := make([]nodeShape, len(node.Children))

	for i, child := range node.Children {
		children[i] = shapeOf(child.Kind, child.Data, len(child.Children))
	}

	return validateChildStructure(node.Data, node.Span, children, path)
}

func validateChildStructure(data Payload, span Span, children []nodeShape, path string) error {
	payload, known := data.(StructuredPayload)
	if !known {
		return nil
	}

	policy := payload.NodeStructure().Children

	invalidChildren := func() error {
		return &ValidationError{Path: path + ".children", Span: &span, Message: "children do not match the node structural contract"}
	}

	if policy.Nonempty && len(children) == 0 {
		return invalidChildren()
	}

	switch policy.Kind {
	case "any":
		return nil

	case "leaf":
		if len(children) != 0 {
			return invalidChildren()
		}

	case "roles":
		for _, child := range children {
			if !slices.Contains(policy.Roles, child.role) {
				return invalidChildren()
			}
		}

	case "types":
		for _, child := range children {
			if !slices.Contains(policy.Types, child.kind) {
				return invalidChildren()
			}
		}

	case "sequence":
		if len(children) < len(policy.Prefix) {
			return invalidChildren()
		}

		arity := -1

		if policy.HasArity {
			counter, ok := data.(interface{ ChildArity() int })
			if !ok {
				return invalidChildren()
			}

			arity = counter.ChildArity()
			if arity <= 0 {
				return invalidChildren()
			}
		}

		for index, child := range children {
			expected := policy.Rest

			if index < len(policy.Prefix) {
				expected = policy.Prefix[index]
			}

			if child.kind != expected || (policy.HasArity && child.children != arity) {
				return invalidChildren()
			}
		}

	default:
		return invalid(path+".data", "unknown node structural policy")
	}

	return nil
}
