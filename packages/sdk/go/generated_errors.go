// Code generated from Rust contracts. DO NOT EDIT.
package markdown

import (
	"encoding/json"
	"fmt"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/ast"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/binding"
	"github.com/traPtitech/traq-flavored-markdown/packages/core/go/contract"
)

type WireError struct {
	Code        ErrorCode    `json:"code"`
	Message     string       `json:"message"`
	Offset      **uint32     `json:"offset,omitempty"`
	Path        **string     `json:"path,omitempty"`
	PayloadType **string     `json:"payload_type,omitempty"`
	Phase       **ParsePhase `json:"phase,omitempty"`
	Resource    **string     `json:"resource,omitempty"`
	Rule        **string     `json:"rule,omitempty"`
	Span        **ErrorSpan  `json:"span,omitempty"`
}

func (value *WireError) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire WireError
	var decoded wire
	if err := contract.Fields(object, "code", "message", "offset", "path", "payload_type", "phase", "resource", "rule", "span"); err != nil {
		return err
	}
	if raw, present := object["code"]; present {
		if err := (contract.Decode[ErrorCode])(raw, &decoded.Code); err != nil {
			return fmt.Errorf("field %q: %w", "code", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "code")
	}
	if raw, present := object["message"]; present {
		if err := (contract.Decode[string])(raw, &decoded.Message); err != nil {
			return fmt.Errorf("field %q: %w", "message", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "message")
	}
	if raw, present := object["offset"]; present {
		var present *uint32
		if err := (func(raw json.RawMessage, value **uint32) error {
			return contract.Nullable(raw, value, func(raw json.RawMessage, value *uint32) error {
				if err := contract.Decode(raw, value); err != nil {
					return err
				}
				if *value < 0 || *value > 4294967295 {
					return fmt.Errorf("number outside schema range")
				}
				return nil
			})
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "offset", err)
		}
		decoded.Offset = &present
	}
	if raw, present := object["path"]; present {
		var present *string
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "path", err)
		}
		decoded.Path = &present
	}
	if raw, present := object["payload_type"]; present {
		var present *string
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "payload_type", err)
		}
		decoded.PayloadType = &present
	}
	if raw, present := object["phase"]; present {
		var present *ParsePhase
		if err := (func(raw json.RawMessage, value **ParsePhase) error {
			return contract.Nullable(raw, value, contract.Decode[ParsePhase])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "phase", err)
		}
		decoded.Phase = &present
	}
	if raw, present := object["resource"]; present {
		var present *string
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "resource", err)
		}
		decoded.Resource = &present
	}
	if raw, present := object["rule"]; present {
		var present *string
		if err := (func(raw json.RawMessage, value **string) error {
			return contract.Nullable(raw, value, contract.Decode[string])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "rule", err)
		}
		decoded.Rule = &present
	}
	if raw, present := object["span"]; present {
		var present *ErrorSpan
		if err := (func(raw json.RawMessage, value **ErrorSpan) error {
			return contract.Nullable(raw, value, contract.Decode[ErrorSpan])
		})(raw, &present); err != nil {
			return fmt.Errorf("field %q: %w", "span", err)
		}
		decoded.Span = &present
	}
	*value = WireError(decoded)
	return nil
}

type ErrorCode string

const (
	ErrorCodeInvalidUtf8     ErrorCode = "invalid_utf8"
	ErrorCodeInvalidRequest  ErrorCode = "invalid_request"
	ErrorCodeInvalidDocument ErrorCode = "invalid_document"
	ErrorCodeUnknownPreset   ErrorCode = "unknown_preset"
	ErrorCodeInvalidMode     ErrorCode = "invalid_mode"
	ErrorCodeNotConfigured   ErrorCode = "not_configured"
	ErrorCodeResourceLimit   ErrorCode = "resource_limit"
	ErrorCodeInternalError   ErrorCode = "internal_error"
)

func (value *ErrorCode) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "invalid_utf8", "invalid_request", "invalid_document", "unknown_preset", "invalid_mode", "not_configured", "resource_limit", "internal_error"); err != nil {
		return err
	}
	*value = ErrorCode(decoded)
	return nil
}
func (value ErrorCode) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "invalid_utf8", "invalid_request", "invalid_document", "unknown_preset", "invalid_mode", "not_configured", "resource_limit", "internal_error"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

type ErrorSpan struct {
	End   uint32 `json:"end"`
	Start uint32 `json:"start"`
}

func (value *ErrorSpan) UnmarshalJSON(raw []byte) error {
	object, err := contract.Object(raw)
	if err != nil {
		return err
	}
	type wire ErrorSpan
	var decoded wire
	if err := contract.Fields(object, "end", "start"); err != nil {
		return err
	}
	if raw, present := object["end"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contract.Decode(raw, value); err != nil {
				return err
			}
			if *value < 0 || *value > 4294967295 {
				return fmt.Errorf("number outside schema range")
			}
			return nil
		})(raw, &decoded.End); err != nil {
			return fmt.Errorf("field %q: %w", "end", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "end")
	}
	if raw, present := object["start"]; present {
		if err := (func(raw json.RawMessage, value *uint32) error {
			if err := contract.Decode(raw, value); err != nil {
				return err
			}
			if *value < 0 || *value > 4294967295 {
				return fmt.Errorf("number outside schema range")
			}
			return nil
		})(raw, &decoded.Start); err != nil {
			return fmt.Errorf("field %q: %w", "start", err)
		}
	} else {
		return fmt.Errorf("missing required field %q", "start")
	}
	*value = ErrorSpan(decoded)
	return nil
}

type ParsePhase string

const (
	ParsePhaseBlock  ParsePhase = "block"
	ParsePhaseInline ParsePhase = "inline"
	ParsePhaseText   ParsePhase = "text"
)

func (value *ParsePhase) UnmarshalJSON(raw []byte) error {
	var decoded string
	if err := contract.Decode(raw, &decoded); err != nil {
		return err
	}
	if err := contract.Enum(decoded, "block", "inline", "text"); err != nil {
		return err
	}
	*value = ParsePhase(decoded)
	return nil
}
func (value ParsePhase) MarshalJSON() ([]byte, error) {
	if err := contract.Enum(string(value), "block", "inline", "text"); err != nil {
		return nil, err
	}
	return json.Marshal(string(value))
}

func decodeWireError(raw json.RawMessage) (*binding.Error, error) {
	var value WireError
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	result := &binding.Error{Code: string(value.Code), Message: value.Message}
	if value.Offset != nil {
		result.Offset = *value.Offset
	}
	if value.Resource != nil && *value.Resource != nil {
		result.Resource = **value.Resource
	}
	if value.Path != nil && *value.Path != nil {
		result.Path = **value.Path
	}
	if value.Phase != nil && *value.Phase != nil {
		result.Phase = string(**value.Phase)
	}
	if value.Rule != nil && *value.Rule != nil {
		result.Rule = **value.Rule
	}
	if value.PayloadType != nil && *value.PayloadType != nil {
		result.PayloadType = **value.PayloadType
	}
	if value.Span != nil && *value.Span != nil {
		result.Span = &ast.Span{Start: (*value.Span).Start, End: (*value.Span).End}
	}
	return result, nil
}
