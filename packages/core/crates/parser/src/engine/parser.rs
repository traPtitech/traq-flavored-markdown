use super::{Budget, Grammar, Limits, ParseError, ParseState, block, inline, source::SourceView};
use markdown_ast::{Document, ValidatedDocumentBuf, ValidationErrorKind, ValidationLimits};

pub struct Parser {
    grammar: Grammar,
    limits: Limits,
}

impl Parser {
    pub fn new(grammar: &Grammar) -> Self {
        Self {
            grammar: grammar.clone(),
            limits: Limits::default(),
        }
    }

    pub fn with_limits(mut self, limits: Limits) -> Self {
        self.limits = limits;
        self
    }

    pub fn parse(&self, source: &str) -> Result<Document, ParseError> {
        self.parse_validated(source)
            .map(ValidatedDocumentBuf::into_document)
    }

    pub fn parse_inline(&self, source: &str) -> Result<Document, ParseError> {
        self.parse_inline_validated(source)
            .map(ValidatedDocumentBuf::into_document)
    }

    pub fn parse_validated(&self, source: &str) -> Result<ValidatedDocumentBuf, ParseError> {
        self.run(source, false)
    }

    pub fn parse_inline_validated(&self, source: &str) -> Result<ValidatedDocumentBuf, ParseError> {
        self.run(source, true)
    }

    fn run(&self, source: &str, inline_only: bool) -> Result<ValidatedDocumentBuf, ParseError> {
        let grammar = &self.grammar;
        if source.len() > self.limits.document.source_bytes {
            return Err(ParseError::limit("source_bytes"));
        }

        let view = SourceView::new(source);
        let mut budget = Budget::new(self.limits);
        let mut state = ParseState::default();

        let children = if inline_only {
            inline::parse(&view, grammar, &mut budget, &state)?
        } else {
            block::parse(&view, grammar, &mut budget, &mut state)?
        };

        let document = Document {
            source: source.into(),
            children,
        };

        let remaining_work = budget.remaining_work();

        let document = ValidatedDocumentBuf::with_limits(
            document,
            ValidationLimits {
                nodes: self.limits.document.nodes.min(remaining_work),
                ..self.limits.document
            },
        )
        .map_err(|error| match error.kind {
            ValidationErrorKind::SourceBytes => ParseError::limit("source_bytes"),
            ValidationErrorKind::PayloadBytes => ParseError::limit("payload_bytes"),
            ValidationErrorKind::Nodes if remaining_work <= self.limits.document.nodes => {
                ParseError::limit("work")
            }
            ValidationErrorKind::Nodes => ParseError::limit("nodes"),
            ValidationErrorKind::Depth => ParseError::limit("depth"),
            ValidationErrorKind::InvalidSpan | ValidationErrorKind::InvalidNode => {
                ParseError::InternalError
            }
        })?;

        budget.spend(document.validated().node_count())?;

        Ok(document)
    }
}
