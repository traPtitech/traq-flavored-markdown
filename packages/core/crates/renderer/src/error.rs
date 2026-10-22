use markdown_ast::ValidationError;
use markdown_definitions::RegistrationError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Validation(ValidationError),
    Registration(RegistrationError),
    UnsupportedNode {
        payload_type: &'static str,
    },
    InvalidPayload {
        expected: &'static str,
    },
    ResourceLimit {
        resource: &'static str,
        limit: usize,
    },
    Handler {
        message: String,
    },
}
impl Error {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Validation(error) => error.code(),
            Self::Registration(error) => error.code(),
            Self::UnsupportedNode { .. } => "unsupported_node",
            Self::InvalidPayload { .. } => "invalid_payload",
            Self::ResourceLimit { .. } => "resource_limit",
            Self::Handler { .. } => "handler_error",
        }
    }
}
impl From<ValidationError> for Error {
    fn from(error: ValidationError) -> Self {
        Self::Validation(error)
    }
}
impl From<RegistrationError> for Error {
    fn from(error: RegistrationError) -> Self {
        Self::Registration(error)
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(error) => error.fmt(f),
            Self::Registration(error) => error.fmt(f),
            Self::UnsupportedNode { payload_type } => write!(f, "unsupported node: {payload_type}"),
            Self::InvalidPayload { expected } => write!(f, "expected payload {expected}"),
            Self::ResourceLimit { resource, limit } => write!(f, "{resource} limit: {limit}"),
            Self::Handler { message } => f.write_str(message),
        }
    }
}
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Validation(error) => Some(error),
            Self::Registration(error) => Some(error),
            _ => None,
        }
    }
}
