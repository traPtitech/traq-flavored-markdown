use markdown_ast::{Span, ValidationError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    Validation(ValidationError),
    Rendering(markdown_renderer::Error),
    Extraction(markdown_extractor::Error),
    ResourceLimit {
        resource: &'static str,
        limit: usize,
    },
    InvalidEdit {
        span: Span,
    },
    OverlappingEdits {
        span: Span,
        previous_end: usize,
    },
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCategory {
    InvalidDocument,
    ResourceLimit,
    Internal,
}
impl Error {
    pub fn category(&self) -> ErrorCategory {
        use markdown_renderer::Error as Render;
        use markdown_extractor::Error as Extract;
        match self {
            Self::Validation(error) | Self::Rendering(Render::Validation(error)) | Self::Extraction(Extract::Validation(error)) => {
                if error.resource().is_some() { ErrorCategory::ResourceLimit } else { ErrorCategory::InvalidDocument }
            }
            Self::ResourceLimit { .. } | Self::Rendering(Render::ResourceLimit { .. }) => ErrorCategory::ResourceLimit,
            Self::InvalidEdit { .. } | Self::OverlappingEdits { .. }
            | Self::Rendering(Render::InvalidPayload { .. } | Render::UnsupportedNode { .. })
            | Self::Extraction(Extract::InvalidPayload { .. }) => ErrorCategory::InvalidDocument,
            Self::Rendering(Render::Registration(_) | Render::Handler { .. })
            | Self::Extraction(Extract::Registration(_) | Extract::Handler { .. }) => ErrorCategory::Internal,
        }
    }
    pub fn validation(&self) -> Option<&ValidationError> {
        match self {
            Self::Validation(error)
            | Self::Rendering(markdown_renderer::Error::Validation(error))
            | Self::Extraction(markdown_extractor::Error::Validation(error)) => Some(error),
            _ => None,
        }
    }

    pub fn resource(&self) -> Option<&'static str> {
        match self {
            Self::ResourceLimit { resource, .. }
            | Self::Rendering(markdown_renderer::Error::ResourceLimit { resource, .. }) => {
                Some(resource)
            }
            _ => self.validation().and_then(ValidationError::resource),
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Validation(error) => error.code(),
            Self::Rendering(error) => error.code(),
            Self::Extraction(error) => error.code(),
            Self::ResourceLimit { .. } => "resource_limit",
            Self::InvalidEdit { .. } => "invalid_edit",
            Self::OverlappingEdits { .. } => "overlapping_edits",
        }
    }
}
impl From<ValidationError> for Error {
    fn from(error: ValidationError) -> Self {
        Self::Validation(error)
    }
}
impl From<markdown_ast::SourceError> for Error {
    fn from(error: markdown_ast::SourceError) -> Self {
        match error {
            markdown_ast::SourceError::InvalidSpan { span } => Self::InvalidEdit { span },
            markdown_ast::SourceError::OverlappingEdits { span, previous_end } => {
                Self::OverlappingEdits { span, previous_end }
            }
            markdown_ast::SourceError::ResourceLimit { resource, limit } => {
                Self::ResourceLimit { resource, limit }
            }
        }
    }
}
impl From<markdown_renderer::Error> for Error {
    fn from(error: markdown_renderer::Error) -> Self {
        Self::Rendering(error)
    }
}
impl From<markdown_extractor::Error> for Error {
    fn from(error: markdown_extractor::Error) -> Self {
        Self::Extraction(error)
    }
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(error) => error.fmt(f),
            Self::Rendering(error) => error.fmt(f),
            Self::Extraction(error) => error.fmt(f),
            Self::ResourceLimit { resource, limit } => write!(f, "{resource} limit: {limit}"),
            Self::InvalidEdit { span } => {
                write!(f, "invalid source edit at {}..{}", span.start, span.end)
            }
            Self::OverlappingEdits { span, previous_end } => write!(
                f,
                "source edit {}..{} crosses previous end {previous_end}",
                span.start, span.end
            ),
        }
    }
}
impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Validation(error) => Some(error),
            Self::Rendering(error) => Some(error),
            Self::Extraction(error) => Some(error),
            _ => None,
        }
    }
}
