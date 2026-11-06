use super::{
    Budget, Grammar, Limits, ParseError, ParseResource, ParseState, block, inline,
    source::SourceView,
};
use markdown_ast::{Document, MutableDocument, ValidationErrorKind, ValidationLimits};

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

    #[must_use]
    pub fn with_limits(mut self, limits: Limits) -> Self {
        self.limits = limits;
        self
    }

    pub fn parse(&self, source: &str) -> Result<Document, ParseError> {
        self.run(source, false, false).map(|parsed| parsed.document)
    }

    pub fn parse_inline(&self, source: &str) -> Result<Document, ParseError> {
        self.run(source, true, false).map(|parsed| parsed.document)
    }

    pub fn parse_with_syntax(
        &self,
        source: &str,
    ) -> Result<crate::syntax::ParsedSyntax, ParseError> {
        self.run(source, false, true)
    }

    pub fn parse_inline_with_syntax(
        &self,
        source: &str,
    ) -> Result<crate::syntax::ParsedSyntax, ParseError> {
        self.run(source, true, true)
    }

    fn run(
        &self,
        source: &str,
        inline_only: bool,
        capture: bool,
    ) -> Result<crate::syntax::ParsedSyntax, ParseError> {
        let grammar = &self.grammar;
        if source.len() > self.limits.document.source_bytes {
            return Err(ParseError::limit(ParseResource::SourceBytes));
        }

        let mut view = SourceView::new(source);
        if capture {
            view.set_context(crate::engine::syntax::CaptureSyntax);
        }
        let mut budget = Budget::new(self.limits);
        let mut state = ParseState::default();

        let children = if inline_only {
            inline::parse(&view, grammar, &mut budget, &state)?
        } else {
            block::parse(&view, grammar, &mut budget, &mut state)?
        };

        let document = MutableDocument {
            source: source.into(),
            children: children.nodes,
        };

        let remaining_work = budget.remaining_work();

        let document = Document::with_limits(
            document,
            ValidationLimits {
                nodes: self.limits.document.nodes.min(remaining_work),
                ..self.limits.document
            },
        )
        .map_err(|error| match error.kind {
            ValidationErrorKind::SourceBytes => ParseError::limit(ParseResource::SourceBytes),
            ValidationErrorKind::PayloadBytes => ParseError::limit(ParseResource::PayloadBytes),
            ValidationErrorKind::Nodes if remaining_work <= self.limits.document.nodes => {
                ParseError::limit(ParseResource::Work)
            }
            ValidationErrorKind::Nodes => ParseError::limit(ParseResource::Nodes),
            ValidationErrorKind::Depth => ParseError::limit(ParseResource::Depth),
            ValidationErrorKind::InvalidSpan | ValidationErrorKind::InvalidNode => {
                ParseError::InvalidDocument(error)
            }
        })?;

        budget.spend(document.as_view().node_count())?;

        let syntax = crate::syntax::SyntaxTree {
            children: children.syntax.unwrap_or_default(),
            detached: std::mem::take(&mut budget.detached_syntax),
        };
        if capture {
            syntax.validate(&document, &mut budget)?;
        }
        Ok(crate::syntax::ParsedSyntax { document, syntax })
    }
}
