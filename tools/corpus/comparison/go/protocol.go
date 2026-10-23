package worker

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
)

//go:embed protocol_schema.json
var schemaBytes []byte

type schema struct {
	Kind         string
	Name         string
	MinLength    *int
	Pattern      string
	Integer      bool
	Minimum      *float64
	Properties   map[string]*schema
	AllowUnknown bool
	Items        *schema
	Keys         []string
	Enum         []string
	Value        *schema
}

func (s *schema) UnmarshalJSON(data []byte) error {
	type plain schema
	var raw struct {
		*plain
		Values json.RawMessage
	}
	raw.plain = (*plain)(s)
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if s.Kind == "enum" {
		return json.Unmarshal(raw.Values, &s.Enum)
	}
	if s.Kind == "record" {
		return json.Unmarshal(raw.Values, &s.Value)
	}
	return nil
}

var schemas = func() map[string]*schema {
	var values map[string]*schema
	if err := json.Unmarshal(schemaBytes, &values); err != nil {
		panic(err)
	}
	return values
}()

// Validate consumes the same protocol description as the TypeScript loader.
func Validate(name string, data []byte) error {
	definition, exists := schemas[name]
	if !exists {
		return fmt.Errorf("unknown protocol: %s", name)
	}
	var value any
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("invalid %s JSON", name)
	}
	// Unmarshal rejects trailing JSON, just as JSON.parse does in TypeScript.
	if !json.Valid(data) {
		return fmt.Errorf("invalid %s JSON", name)
	}
	return definition.validate(value, name)
}

func (s *schema) validate(value any, location string) error {
	fail := func() error { return fmt.Errorf("invalid %s", location) }
	switch s.Kind {
	case "string":
		text, ok := value.(string)
		if !ok || (s.MinLength != nil && len(text) < *s.MinLength) || (s.Pattern != "" && !regexp.MustCompile(s.Pattern).MatchString(text)) {
			return fail()
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			return fail()
		}
	case "number":
		number, ok := value.(json.Number)
		if !ok {
			return fail()
		}
		parsed, err := number.Float64()
		if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) || (s.Integer && (math.Trunc(parsed) != parsed || math.Abs(parsed) > 9007199254740991)) || (s.Minimum != nil && parsed < *s.Minimum) {
			return fail()
		}
	case "enum":
		for _, candidate := range s.Enum {
			if value == candidate {
				return nil
			}
		}
		return fail()
	case "array":
		items, ok := value.([]any)
		if !ok {
			return fail()
		}
		for index, item := range items {
			if err := s.Items.validate(item, fmt.Sprintf("%s[%d]", location, index)); err != nil {
				return err
			}
		}
	case "object", "record":
		fields, ok := value.(map[string]any)
		if !ok {
			return fail()
		}
		if s.Kind == "object" {
			for key, definition := range s.Properties {
				if err := definition.validate(fields[key], location+"."+key); err != nil {
					return err
				}
			}
			if !s.AllowUnknown && len(fields) != len(s.Properties) {
				return fail()
			}
		} else {
			if s.Keys != nil {
				if len(fields) != len(s.Keys) {
					return fail()
				}
				for _, key := range s.Keys {
					if _, found := fields[key]; !found {
						return fail()
					}
				}
			}
			for key, field := range fields {
				if err := s.Value.validate(field, location+"."+key); err != nil {
					return err
				}
			}
		}
	default:
		return fmt.Errorf("unknown schema kind: %s", s.Kind)
	}
	return nil
}

func decode[T any](name string, data []byte, output *T) error {
	if err := Validate(name, data); err != nil {
		return err
	}
	// JSON integer spellings such as 1.0 and 1e0 have the same meaning in both hosts.
	var normalized any
	if err := json.Unmarshal(data, &normalized); err != nil {
		return err
	}
	canonical, err := json.Marshal(normalized)
	if err != nil {
		return err
	}
	return json.Unmarshal(canonical, output)
}

func ParsePlan(data []byte) (ComparisonPlan, error) {
	var plan ComparisonPlan
	err := decode("plan", data, &plan)
	return plan, err
}
