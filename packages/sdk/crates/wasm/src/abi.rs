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
    pub resource: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<ErrorSpan>,
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
        reply.path = Some(error.path.iter().fold(String::from("$"), |path, index| {
            format!("{path}.children[{index}]")
        }));
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
        let code = match error.code() {
            "invalid_payload" | "invalid_node" | "unsupported_node" | "invalid_edit"
            | "overlapping_edits" => ErrorCode::InvalidDocument,
            _ => ErrorCode::InternalError,
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
                }),
        );
        error.span = validation.span.and_then(wire_span);
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
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
    pub contract_id: &'static str,
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
pub fn descriptor() -> serde_json::Value {
    let error = schemars::generate::SchemaSettings::default()
        .with(|settings| settings.contract = schemars::generate::Contract::Serialize)
        .into_generator()
        .into_root_schema_for::<Error>();
    serde_json::json!({
        "version": 1,
        "operations": {
            "configure": { "export": "configure", "input": "text", "params": [], "result": "configuration", "configuration": true },
            "configureExtractor": { "export": "configure_extractor", "input": "json", "params": [], "result": "configuration", "configuration": true },
            "configureRenderer": { "export": "configure_renderer", "input": "json", "params": [], "result": "configuration", "configuration": true },
            "parse": { "export": "parse", "input": "text", "params": ["i32"], "result": "document", "configuration": false },
            "extract": { "export": "extract", "input": "json", "params": [], "result": "extraction", "configuration": false },
            "render": { "export": "render", "input": "json", "params": [], "result": "text", "configuration": false }
        },
        "exports": {
            "input_ptr": {"params":["i32"],"results":["i32"]},
            "output_ptr": {"params":[],"results":["i32"]},
            "contract_ptr": {"params":[],"results":["i32"]},
            "contract_len": {"params":[],"results":["i32"]},
            "configure": {"params":[],"results":["i32"]},
            "configure_extractor": {"params":[],"results":["i32"]},
            "configure_renderer": {"params":[],"results":["i32"]},
            "parse": {"params":["i32"],"results":["i32"]},
            "extract": {"params":[],"results":["i32"]},
            "render": {"params":[],"results":["i32"]}
        },
        "error": error
    })
}
