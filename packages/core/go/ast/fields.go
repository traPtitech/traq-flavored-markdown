package ast

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

func strict(raw []byte, output any) error {
	if err := exactFields(raw, reflect.TypeOf(output).Elem()); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	return decoder.Decode(output)
}

// Go's default struct decoder matches keys case-insensitively; wire fields are
// exact names, including the nested span object.
func exactFields(raw []byte, shape reflect.Type) error {
	for shape.Kind() == reflect.Pointer {
		shape = shape.Elem()
	}
	if shape.Kind() != reflect.Struct {
		return nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}
	allowed := make(map[string]reflect.Type, shape.NumField())
	for i := 0; i < shape.NumField(); i++ {
		field := shape.Field(i)
		name := strings.Split(field.Tag.Get("json"), ",")[0]
		if name != "-" {
			allowed[name] = field.Type
		}
	}
	for name, value := range fields {
		field, ok := allowed[name]
		if !ok {
			return fmt.Errorf("unknown field: %s", name)
		}
		if err := exactFields(value, field); err != nil {
			return err
		}
	}
	return nil
}
