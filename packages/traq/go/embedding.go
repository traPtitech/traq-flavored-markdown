package markdown

import (
	"encoding/json"
	"fmt"
	"strings"
)

// EmbedReferences resolves Rust's ordered AST-derived candidates, preserving all other source bytes.
func EmbedReferences(
	source string,
	plan EmbeddingPlan,
	resolve func(LookupKind, string) (string, bool),
) (string, error) {
	var result strings.Builder

	position := uint64(0)

	for _, candidate := range plan.Candidates {
		start, end := uint64(candidate.Start), uint64(candidate.End)

		if start < position {
			continue
		}

		if end <= start || end > uint64(len(source)) || source[start:end] != candidate.Raw {
			return "", fmt.Errorf("embedding plan does not match source")
		}

		id, ok := resolve(candidate.Kind, candidate.Name)
		if !ok || id == "" {
			continue
		}

		value := struct {
			Type LookupKind `json:"type"`
			Raw  string     `json:"raw"`
			ID   string     `json:"id"`
		}{candidate.Kind, candidate.Raw, id}

		encoded, err := json.Marshal(value)
		if err != nil {
			return "", err
		}

		result.WriteString(source[position:start])
		result.WriteByte('!')
		result.Write(encoded)

		position = end
	}

	result.WriteString(source[position:])

	return result.String(), nil
}
