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
            ErrorKind::Validation(error) => Some(error.as_ref()),
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
            ErrorKind::Json(_) => f.write_str("document JSON processing failed"),
            ErrorKind::Validation(_) => f.write_str("document failed codec validation"),
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
            ErrorKind::Validation(error) => Some(error.as_ref()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error as _;

    #[test]
    fn json_errors_keep_the_original_cause_without_repeating_its_message() {
        let error = Error::from(serde_json::from_str::<bool>("?").unwrap_err());
        let ErrorKind::Json(cause) = &error.kind else {
            panic!("expected the JSON error category");
        };
        let source = error.source().unwrap();
        assert!(std::ptr::eq(
            source.downcast_ref::<serde_json::Error>().unwrap(),
            cause
        ));
        let report = format!("{error}: {source}");
        assert_eq!(report.matches(&cause.to_string()).count(), 1);
        assert_eq!(error.code(), "invalid_document");
    }

    #[test]
    fn validation_errors_expose_the_underlying_value_and_keep_its_location() {
        let error = Error::from(ValidationError {
            kind: markdown_ast::ValidationErrorKind::InvalidSpan,
            path: vec![0, 1],
            span: Some(Span { start: 2, end: 4 }),
            payload_type: Some("text"),
            payload: None,
        });
        let source = error.source().unwrap();
        assert!(std::ptr::eq(
            source.downcast_ref::<ValidationError>().unwrap(),
            error.validation().unwrap()
        ));
        assert_eq!(error.path, [0, 1]);
        assert_eq!(error.span, Some(Span { start: 2, end: 4 }));
        assert_eq!(error.code(), "invalid_node");
        let report = format!("{error}: {source}");
        assert_eq!(report.matches("invalid span").count(), 1);
    }
}
