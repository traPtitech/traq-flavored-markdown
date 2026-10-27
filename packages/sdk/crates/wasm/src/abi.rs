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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ErrorSpan {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
    pub phase: Option<ParsePhase>,
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
            Self::new(ErrorCode::InvalidDocument, describe_error(&error))
        };
        reply.path = Some(wire_path(&error.path));
        reply.span = error.span.and_then(wire_span);
        reply
    }
    pub fn encoding(error: markdown_codec::Error) -> Self {
        if error.resource() == Some("json_bytes") {
            return Self::limit("output_bytes");
        }
        let limited = error.resource().is_some();
        let mut reply = Self::document(error);
        if !limited {
            reply.code = ErrorCode::InternalError;
        }
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
        let mut reply = Self::new(code, describe_error(&error));
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
        error.path = Some(wire_path(&validation.path));
        error.span = validation.span.and_then(wire_span);
        error.payload_type = validation.payload_type.map(Into::into);
        error
    }
    pub fn not_configured() -> Self {
        Self::new(ErrorCode::NotConfigured, "operation is not configured")
    }
}

// The wire format has one message string rather than an Error::source chain.
// Render the complete chain here so native wrappers can add context without
// repeating their causes in their own Display implementations.
fn describe_error(error: &dyn std::error::Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        message.push_str(": ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }
    message
}

fn wire_path(indices: &[usize]) -> Box<str> {
    indices
        .iter()
        .fold(String::from("$"), |path, index| {
            format!("{path}.children[{index}]")
        })
        .into_boxed_str()
}

#[derive(Debug, Clone, Copy, Serialize)]
#[cfg_attr(feature = "contracts", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum ParsePhase {
    Block,
    Inline,
    Text,
}
impl From<markdown_parser::ParsePhase> for ParsePhase {
    fn from(phase: markdown_parser::ParsePhase) -> Self {
        use markdown_parser::ParsePhase as Native;
        match phase {
            Native::Block => Self::Block,
            Native::Inline => Self::Inline,
            Native::Text => Self::Text,
        }
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
            ParseError::ResourceLimit { resource } => Self::limit(resource.as_str()),
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
                reply.phase = Some(phase.into());
                reply.rule = rule.map(String::into_boxed_str);
                reply.offset = position.try_into().ok();
                reply
            }
            ParseError::InvalidDocument(validation) => {
                let mut reply = Self::validation(&validation);
                reply.code = ErrorCode::InternalError;
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
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
#[allow(
    dead_code,
    reason = "The native exporter calls this descriptor, while the Wasm library does not"
)]
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
                )
                .request_schema("ExtractorOptions"),
            ),
            (
                "configureRenderer",
                Operation::new(
                    "configure_renderer",
                    Input::Json,
                    vec![],
                    Output::Configuration,
                )
                .request_schema("PlainTextOptions"),
            ),
            (
                "parse",
                Operation::new("parse", Input::Text, vec![WasmType::I32], Output::Document),
            ),
            (
                "extract",
                Operation::new("extract", Input::Json, vec![], Output::Extraction)
                    .response_schema("Extraction"),
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
                )
                .request_schema("ProcessorConfiguration"),
            ),
            (
                "process",
                Operation::new(
                    "process",
                    Input::Text,
                    vec![WasmType::I32],
                    Output::Processing,
                )
                .response_schema("ProcessingResult"),
            ),
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::{Error, ErrorCode};
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
            assert_eq!(wire["payloadType"], "example::Heading");
            assert_eq!(wire["path"], "$.children[1].children[2]");
            assert_eq!(wire["span"], serde_json::json!({"start": 3, "end": 7}));
        }
    }

    #[test]
    fn wire_messages_preserve_each_cause_once() {
        let json_error = serde_json::from_str::<serde_json::Value>("{").unwrap_err();
        let json_message = json_error.to_string();
        let reply = Error::document(json_error.into());
        assert!(matches!(reply.code, ErrorCode::InvalidDocument));
        assert_eq!(reply.message.matches(&json_message).count(), 1);
        assert!(reply.message.ends_with(&json_message));
        assert_ne!(reply.message, json_message);

        let handler = markdown_renderer::Error::Handler {
            message: "custom handler detail".into(),
        };
        let reply = Error::processing(handler.into());
        assert!(matches!(reply.code, ErrorCode::InternalError));
        assert_eq!(reply.message.matches("custom handler detail").count(), 1);
        assert!(reply.message.contains(": "));
    }
}
