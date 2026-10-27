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
        use markdown_extractor::Error as Extract;
        use markdown_renderer::Error as Render;
        match self {
            Self::Validation(error)
            | Self::Rendering(Render::Validation(error))
            | Self::Extraction(Extract::Validation(error)) => {
                if error.resource().is_some() {
                    ErrorCategory::ResourceLimit
                } else {
                    ErrorCategory::InvalidDocument
                }
            }
            Self::ResourceLimit { .. } | Self::Rendering(Render::ResourceLimit { .. }) => {
                ErrorCategory::ResourceLimit
            }
            Self::InvalidEdit { .. }
            | Self::OverlappingEdits { .. }
            | Self::Rendering(Render::InvalidPayload { .. } | Render::UnsupportedNode { .. })
            | Self::Extraction(Extract::InvalidPayload { .. }) => ErrorCategory::InvalidDocument,
            Self::Rendering(Render::Registration(_) | Render::Handler { .. })
            | Self::Extraction(Extract::Registration(_) | Extract::Handler { .. }) => {
                ErrorCategory::Internal
            }
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
            Self::Validation(_) => f.write_str("processing requires a valid document"),
            Self::Rendering(_) => f.write_str("plain-text rendering failed"),
            Self::Extraction(_) => f.write_str("message extraction failed"),
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

#[cfg(test)]
mod tests {
    use super::*;
    use markdown_ast::{PayloadError, ValidationErrorKind};
    use std::error::Error as _;

    #[test]
    fn rendering_error_chain_keeps_each_cause_and_validation_location() {
        let error = Error::from(markdown_renderer::Error::from(ValidationError {
            kind: ValidationErrorKind::InvalidNode,
            path: vec![0, 2],
            span: Some(Span { start: 3, end: 5 }),
            payload_type: Some("heading"),
            payload: Some(PayloadError::new("level from 1 to 6").actual("0")),
        }));

        let Error::Rendering(rendering) = &error else {
            panic!("expected a rendering error");
        };
        let source = error.source().unwrap();
        assert!(std::ptr::eq(
            source.downcast_ref::<markdown_renderer::Error>().unwrap(),
            rendering
        ));
        let validation = error.validation().unwrap();
        let cause = source.source().unwrap();
        assert!(std::ptr::eq(
            cause.downcast_ref::<ValidationError>().unwrap(),
            validation
        ));
        assert_eq!(validation.path, [0, 2]);
        assert_eq!(validation.span, Some(Span { start: 3, end: 5 }));
        assert_eq!(error.category(), ErrorCategory::InvalidDocument);
        assert_eq!(error.code(), "invalid_node");

        let report = format!("{error}: {source}: {cause}");
        assert!(report.contains("plain-text rendering failed"));
        assert!(report.contains("rendering requires a valid document"));
        assert_eq!(report.matches("expected level from 1 to 6").count(), 1);
        assert_eq!(report.matches("got 0").count(), 1);
        assert!(cause.source().is_none());
    }

    #[test]
    fn extraction_registration_errors_keep_the_typed_cause_and_plugin_details() {
        let mut plugin = markdown_extractor::ExtractionPlugin::new(
            &markdown_traq_contracts::declarations().references,
        );
        plugin
            .on::<markdown_commonmark_contracts::Text>(|_, _, _: &mut ()| Ok(()))
            .unwrap();
        let registration = plugin
            .on::<markdown_commonmark_contracts::Text>(|_, _, _: &mut ()| Ok(()))
            .unwrap_err();
        let error = Error::from(registration);
        let Error::Extraction(markdown_extractor::Error::Registration(registration)) = &error
        else {
            panic!("expected an extraction registration error");
        };
        let source = error.source().unwrap();
        let cause = source.source().unwrap();
        assert!(std::ptr::eq(cause.downcast_ref().unwrap(), registration));
        assert_eq!(registration.plugin, "references");
        assert_eq!(error.category(), ErrorCategory::Internal);
        assert_eq!(error.code(), "duplicate_handler");
        let report = format!("{error}: {source}: {cause}");
        assert!(report.contains("message extraction failed"));
        assert!(report.contains("extraction handler registration failed"));
        assert_eq!(report.matches("references").count(), 1);
        assert!(report.contains(std::any::type_name::<markdown_commonmark_contracts::Text>()));
    }
}
