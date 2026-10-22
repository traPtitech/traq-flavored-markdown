//! Distribution-owned operation and error contract. Hosts generate descriptors here.
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidUtf8,
    InvalidRequest,
    InvalidDocument,
    UnknownPreset,
    InvalidMode,
    NotConfigured,
    ResourceLimit,
    InternalError,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ErrorSpan {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct Error {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<Box<str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Box<str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<ErrorSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<markdown_parser::engine::ParsePhase>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule: Option<Box<str>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_type: Option<Box<str>>,
}

impl Error {
    pub fn new(code: ErrorCode, message: impl ToString) -> Self {
        Self {
            code,
            message: message.to_string(),
            resource: None,
            path: None,
            offset: None,
            span: None,
            phase: None,
            rule: None,
            payload_type: None,
        }
    }
    pub fn limit(resource: &str) -> Self {
        let mut error = Self::new(
            ErrorCode::ResourceLimit,
            format!("{resource} limit exceeded"),
        );
        error.resource = Some(resource.into());
        error
    }
    pub fn request(error: impl ToString) -> Self {
        Self::new(ErrorCode::InvalidRequest, error)
    }
    pub fn document(error: markdown_codec::Error) -> Self {
        if let Some(validation) = error.validation() {
            return Self::validation(validation);
        }
        let mut reply = if let Some(resource) = error.resource() {
            Self::limit(resource)
        } else {
            Self::new(ErrorCode::InvalidDocument, &error)
        };
        reply.path = Some(
            error
                .path
                .iter()
                .fold(String::from("$"), |path, index| {
                    format!("{path}.children[{index}]")
                })
                .into_boxed_str(),
        );
        reply.span = error.span.and_then(wire_span);
        reply
    }
    pub fn processing(error: traq_markdown_processing::Error) -> Self {
        if let Some(validation) = error.validation() {
            return Self::validation(validation);
        }
        if let Some(resource) = error.resource() {
            return Self::limit(resource);
        }
        let code = match error.category() {
            traq_markdown_processing::ErrorCategory::InvalidDocument => ErrorCode::InvalidDocument,
            traq_markdown_processing::ErrorCategory::ResourceLimit => ErrorCode::ResourceLimit,
            traq_markdown_processing::ErrorCategory::Internal => ErrorCode::InternalError,
        };
        let mut reply = Self::new(code, &error);
        match error {
            traq_markdown_processing::Error::InvalidEdit { span }
            | traq_markdown_processing::Error::OverlappingEdits { span, .. } => {
                reply.span = wire_span(span)
            }
            _ => {}
        }
        reply
    }
    pub fn validation(validation: &markdown_ast::ValidationError) -> Self {
        let mut error = if let Some(resource) = validation.resource() {
            Self::limit(resource)
        } else {
            Self::new(ErrorCode::InvalidDocument, validation)
        };
        error.path = Some(
            validation
                .path
                .iter()
                .fold(String::from("$"), |path, index| {
                    format!("{path}.children[{index}]")
                })
                .into_boxed_str(),
        );
        error.span = validation.span.and_then(wire_span);
        error.payload_type = validation.payload_type.map(Into::into);
        error
    }
    pub fn not_configured() -> Self {
        Self::new(ErrorCode::NotConfigured, "operation is not configured")
    }
}

fn wire_span(span: markdown_ast::Span) -> Option<ErrorSpan> {
    Some(ErrorSpan {
        start: span.start.try_into().ok()?,
        end: span.end.try_into().ok()?,
    })
}

impl From<traq_markdown_grammar::ParseError> for Error {
    fn from(error: traq_markdown_grammar::ParseError) -> Self {
        use traq_markdown_grammar::ParseError;
        match error {
            ParseError::InvalidUtf8 => {
                Self::new(ErrorCode::InvalidUtf8, "source is not valid UTF-8")
            }
            ParseError::ResourceLimit { resource } => Self::limit(&resource),
            ParseError::InternalError => {
                Self::new(ErrorCode::InternalError, "parser invariant failed")
            }
            ParseError::InvalidRuleOutput {
                phase,
                rule,
                position,
                reason,
            } => {
                let mut reply = Self::new(ErrorCode::InternalError, reason);
                reply.phase = Some(phase);
                reply.rule = rule.map(String::into_boxed_str);
                reply.offset = position.try_into().ok();
                reply
            }
            ParseError::InvalidDocument {
                path,
                start,
                end,
                payload_type,
                reason,
            } => {
                let mut reply = Self::new(ErrorCode::InternalError, reason);
                reply.path = Some(
                    path.iter()
                        .fold(String::from("$"), |path, index| {
                            format!("{path}.children[{index}]")
                        })
                        .into_boxed_str(),
                );
                reply.span = start
                    .zip(end)
                    .and_then(|(start, end)| wire_span(markdown_ast::Span { start, end }));
                reply.payload_type = payload_type.map(String::into_boxed_str);
                reply
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
    pub contract_id: &'static str,
}

#[derive(serde::Deserialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(deny_unknown_fields)]
pub struct ProcessorConfiguration {
    pub preset: String,
    #[serde(default)]
    pub options: traq_markdown_processing::pipeline::ProcessorOptions,
}
pub const CONTRACT_ID: &str = match option_env!("MARKDOWN_CONTRACT_ID") {
    Some(value) => value,
    None => "development-unbound",
};
pub fn configured() -> Configuration {
    Configuration {
        contract_id: CONTRACT_ID,
    }
}

#[cfg(feature = "contracts")]
#[allow(dead_code)] // Used by the native exporter, not the Wasm library target.
pub fn descriptor() -> markdown_contract_export::Result<markdown_contract_export::AbiContract> {
    use markdown_contract_export::{AbiContract, Input, Operation, Output, WasmType, schema};
    AbiContract::buffered(
        1,
        schema::<Error>(schemars::generate::Contract::Serialize),
        [
            (
                "configure",
                Operation::new("configure", Input::Text, vec![], Output::Configuration),
            ),
            (
                "configureExtractor",
                Operation::new(
                    "configure_extractor",
                    Input::Json,
                    vec![],
                    Output::Configuration,
                ),
            ),
            (
                "configureRenderer",
                Operation::new(
                    "configure_renderer",
                    Input::Json,
                    vec![],
                    Output::Configuration,
                ),
            ),
            (
                "parse",
                Operation::new("parse", Input::Text, vec![WasmType::I32], Output::Document),
            ),
            (
                "extract",
                Operation::new("extract", Input::Json, vec![], Output::Extraction),
            ),
            (
                "render",
                Operation::new("render", Input::Json, vec![], Output::Text),
            ),
            (
                "configureProcessor",
                Operation::new(
                    "configure_processor",
                    Input::Json,
                    vec![],
                    Output::Configuration,
                ),
            ),
            (
                "process",
                Operation::new(
                    "process",
                    Input::Text,
                    vec![WasmType::I32],
                    Output::Processing,
                ),
            ),
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::Error;
    use markdown_ast::{Span, ValidationError, ValidationErrorKind};

    #[test]
    fn validation_context_survives_codec_and_processing_boundaries() {
        let validation = ValidationError {
            kind: ValidationErrorKind::InvalidNode,
            path: vec![1, 2],
            span: Some(Span { start: 3, end: 7 }),
            payload_type: Some("example::Heading"),
            payload: None,
        };
        for error in [
            Error::validation(&validation),
            Error::document(validation.clone().into()),
            Error::processing(validation.into()),
        ] {
            let wire = serde_json::to_value(error).unwrap();
            assert_eq!(wire["code"], "invalid_document");
            assert_eq!(wire["payload_type"], "example::Heading");
            assert_eq!(wire["path"], "$.children[1].children[2]");
            assert_eq!(wire["span"], serde_json::json!({"start": 3, "end": 7}));
        }
    }
}
