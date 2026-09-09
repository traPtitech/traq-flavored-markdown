use super::{Budget, Grammar, Limits, ParseError, block, inline, source::SourceView};
use markdown_ast::{Document, ValidationError, ValidationLimits};

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
        self.run(source, false)
    }

    pub fn parse_inline(&self, source: &str) -> Result<Document, ParseError> {
        self.run(source, true)
    }

    fn run(&self, source: &str, inline_only: bool) -> Result<Document, ParseError> {
        let grammar = &self.grammar;
        if source.len() > self.limits.input_bytes {
            return Err(ParseError::limit("input_bytes"));
        }

        let view = SourceView::new(source);
        let mut budget = Budget::new(self.limits);

        let children = if inline_only {
            inline::parse(&view, grammar, &mut budget, &block::References::new())?
        } else {
            block::parse(&view, grammar, &mut budget)?
        };

        let document = Document {
            source: source.into(),
            children,
        };

        let remaining_work = budget.remaining_work();

        let node_count = document
            .validate(ValidationLimits {
                source_bytes: self.limits.input_bytes,
                nodes: self.limits.nodes.min(remaining_work),
                depth: self.limits.depth,
            })
            .map_err(|error| match error {
                ValidationError::SourceBytes => ParseError::limit("input_bytes"),
                ValidationError::Nodes if remaining_work <= self.limits.nodes => {
                    ParseError::limit("work")
                }
                ValidationError::Nodes => ParseError::limit("tokens"),
                ValidationError::Depth => ParseError::limit("depth"),
                ValidationError::InvalidSpan | ValidationError::InvalidNode => {
                    ParseError::InternalError
                }
            })?;

        budget.spend(node_count)?;

        Ok(document)
    }
}
