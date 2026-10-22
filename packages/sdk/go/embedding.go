package markdown

import (
	"encoding/json"
	"fmt"
	"unicode/utf8"

	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
)

// EmbedReferences resolves Rust's ordered AST-derived candidates, preserving all other source bytes.
func EmbedReferences(
	source string,
	plan ReferenceEmbeddingPlan,
	resolve func(LookupKind, string) (string, bool),
) (string, error) {
	text, err := ast.NewSourceText(source)
	if err != nil {
		return "", err
	}
	candidates := append([]ReferenceEmbeddingCandidate(nil), plan.Candidates...)
	// Validate every candidate before invoking caller code, including candidates
	// that will be skipped after an overlapping earlier replacement is resolved.
	for _, candidate := range candidates {
		raw, err := text.Slice(ast.Span{Start: candidate.Start, End: candidate.End})
		if err != nil || candidate.End <= candidate.Start || raw != candidate.Raw {
			return "", fmt.Errorf("embedding plan does not match source")
		}
		if !utf8.ValidString(candidate.Name) {
			return "", fmt.Errorf("embedding candidate is not valid UTF-8")
		}
		if candidate.Kind != LookupKindUser && candidate.Kind != LookupKindGroup && candidate.Kind != LookupKindChannel {
			return "", fmt.Errorf("invalid embedding lookup kind")
		}
	}
	position := uint32(0)
	edits := make([]ast.SourceEdit, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.Start < position {
			continue
		}

		id, ok := resolve(candidate.Kind, candidate.Name)
		if !ok || id == "" {
			continue
		}
		if !utf8.ValidString(id) {
			return "", fmt.Errorf("resolved identifier is not valid UTF-8")
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

		edits = append(edits, ast.SourceEdit{Span: ast.Span{Start: candidate.Start, End: candidate.End}, Text: "!" + string(encoded)})
		position = candidate.End
	}
	return text.Replace(edits)
}
