package ast

import (
	"fmt"
	"reflect"
	"unicode/utf8"
)

func nilValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Pointer, reflect.Interface, reflect.Map, reflect.Slice:
		return v.IsNil()
	}
	return false
}
func validStrings(v reflect.Value, seen map[uintptr]bool, depth int, payloadBytes *int) error {
	if !v.IsValid() {
		return nil
	}
	if depth > 128 {
		return limit("", "payload_depth")
	}
	if *payloadBytes >= maxJSONBytes {
		return limit("", "payload_bytes")
	}
	*payloadBytes++
	switch v.Kind() {
	case reflect.String:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		*payloadBytes += v.Len()
		if !utf8.ValidString(v.String()) {
			return fmt.Errorf("invalid UTF-8 string")
		}
	case reflect.Interface:
		if !v.IsNil() {
			return validStrings(v.Elem(), seen, depth+1, payloadBytes)
		}
	case reflect.Pointer:
		if !v.IsNil() {
			id := v.Pointer()
			if seen[id] {
				return fmt.Errorf("cyclic payload")
			}
			seen[id] = true
			defer delete(seen, id)
			return validStrings(v.Elem(), seen, depth+1, payloadBytes)
		}
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			if err := validStrings(v.Field(i), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	case reflect.Slice, reflect.Array:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		for i := 0; i < v.Len(); i++ {
			if err := validStrings(v.Index(i), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	case reflect.Map:
		if v.Len() > maxJSONBytes-*payloadBytes {
			return limit("", "payload_bytes")
		}
		iterator := v.MapRange()
		for iterator.Next() {
			if err := validStrings(iterator.Key(), seen, depth+1, payloadBytes); err != nil {
				return err
			}
			if err := validStrings(iterator.Value(), seen, depth+1, payloadBytes); err != nil {
				return err
			}
		}
	}
	return nil
}
