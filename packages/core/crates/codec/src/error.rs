use markdown_ast::{Span, ValidationError};

/// Codec failures retain categories and location instead of flattening native
/// validation and allocation limits into JSON parser messages.
#[derive(Debug)]
pub struct Error {
    pub kind: ErrorKind,
    pub path: Vec<usize>,
    pub span: Option<Span>,
}

#[derive(Debug)]
pub enum ErrorKind {
    Json(serde_json::Error),
    Validation(Box<ValidationError>),
    MissingField {
        name: String,
    },
    UnknownFields {
        names: Vec<String>,
    },
    UnknownContract {
        name: String,
    },
    UnregisteredPayload {
        payload_type: &'static str,
    },
    InvalidContractKey {
        key: String,
        payload_type: &'static str,
    },
    DuplicateContract {
        key: String,
        payload_type: &'static str,
    },
    InvalidSpan {
        parent: Span,
        previous_end: usize,
    },
    ResourceLimit {
        resource: &'static str,
        limit: usize,
    },
}

impl Error {
    pub(crate) fn new(kind: ErrorKind) -> Self {
        Self {
            kind,
            path: vec![],
            span: None,
        }
    }
    pub(crate) fn at(mut self, path: &[usize], span: Option<Span>) -> Self {
        if self.path.is_empty() {
            self.path = path.to_vec();
        }
        if self.span.is_none() {
            self.span = span;
        }
        self
    }
    pub fn code(&self) -> &'static str {
        match &self.kind {
            ErrorKind::Validation(error) => error.code(),
            ErrorKind::ResourceLimit { .. } => "resource_limit",
            ErrorKind::InvalidContractKey { .. } | ErrorKind::DuplicateContract { .. } => {
                "invalid_configuration"
            }
            ErrorKind::UnregisteredPayload { .. } => "unsupported_node",
            _ => "invalid_document",
        }
    }
    pub fn resource(&self) -> Option<&'static str> {
        match &self.kind {
            ErrorKind::ResourceLimit { resource, .. } => Some(resource),
            ErrorKind::Validation(error) => error.resource(),
            _ => None,
        }
    }
    pub fn validation(&self) -> Option<&ValidationError> {
        match &self.kind {
            ErrorKind::Validation(error) => Some(error),
            _ => None,
        }
    }
}
impl From<serde_json::Error> for Error {
    fn from(error: serde_json::Error) -> Self {
        Self::new(ErrorKind::Json(error))
    }
}
impl From<ValidationError> for Error {
    fn from(error: ValidationError) -> Self {
        Self {
            path: error.path.clone(),
            span: error.span,
            kind: ErrorKind::Validation(Box::new(error)),
        }
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.kind {
            ErrorKind::Json(error) => error.fmt(f),
            ErrorKind::Validation(error) => error.fmt(f),
            ErrorKind::MissingField { name } => write!(f, "missing field {name:?}"),
            ErrorKind::UnknownFields { names } => write!(f, "unknown envelope fields: {names:?}"),
            ErrorKind::UnknownContract { name } => write!(f, "unknown contract {name:?}"),
            ErrorKind::UnregisteredPayload { payload_type } => {
                write!(f, "unregistered node type {payload_type}")
            }
            ErrorKind::InvalidContractKey { key, payload_type } => {
                write!(f, "invalid node type key {key:?} for {payload_type}")
            }
            ErrorKind::DuplicateContract { key, payload_type } => write!(
                f,
                "duplicate Rust type or wire contract {key:?} for {payload_type}"
            ),
            ErrorKind::InvalidSpan {
                parent,
                previous_end,
            } => write!(
                f,
                "invalid span {:?} inside {parent:?}, after {previous_end}",
                self.span
            ),
            ErrorKind::ResourceLimit { resource, limit } => write!(f, "{resource} limit: {limit}"),
        }
    }
}
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match &self.kind {
            ErrorKind::Json(error) => Some(error),
            ErrorKind::Validation(error) => Some(error),
            _ => None,
        }
    }
}
