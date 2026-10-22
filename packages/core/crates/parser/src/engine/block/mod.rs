mod input;
mod lines;
pub use lines::{LineIndex, Lines};
mod rule;
pub use rule::BlockRule;
mod draft;
mod scan;

use super::{Budget, Grammar, ParseError, ParseState, source::SourceView};
pub use draft::{DraftContent, DraftNode, ResolvedBlock, ResolvedContent};
pub(crate) use scan::parse;

pub struct BlockBatch {
    pub nodes: Vec<ResolvedBlock>,
    pub metadata: ParseState,
}

type Commit = Box<dyn FnOnce(&mut ParseState, &mut Budget) -> Result<(), ParseError>>;

pub struct BlockMatch {
    pub end: LineIndex,
    pub nodes: Vec<DraftNode>,
    pub(crate) commits: Vec<Commit>,
    pub following: Following,
}

impl BlockMatch {
    pub fn node(end: LineIndex, node: DraftNode) -> Self {
        Self {
            end,
            nodes: vec![node],
            commits: vec![],
            following: Following::Policy,
        }
    }

    pub fn ignore(end: LineIndex) -> Self {
        Self {
            end,
            nodes: vec![],
            commits: vec![],
            following: Following::Preserve,
        }
    }

    /// Runs after the parser accepts this match, before resolving its block children.
    pub fn on_accept(
        mut self,
        commit: impl FnOnce(&mut ParseState, &mut Budget) -> Result<(), ParseError> + 'static,
    ) -> Self {
        self.commits.push(Box::new(commit));
        self
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Following {
    Policy,
    Preserve,
}

/// Syntax-owned behavior between accepted blocks. State is local to each
/// block sequence, so nested containers cannot affect siblings.
pub trait BlockPolicy: Send + Sync {
    fn after_match(
        &self,
        input: &BlockInput<'_>,
        end: LineIndex,
        metadata: &mut ParseState,
    ) -> Result<LineIndex, ParseError>;
}

pub struct BlockProbe<'a> {
    pub line: &'a str,
    pub next: Option<&'a str>,
    context: &'a dyn std::any::Any,
}
impl BlockProbe<'_> {
    pub fn context<T: 'static>(&self) -> Option<&T> {
        self.context.downcast_ref()
    }
}

pub struct BlockInput<'a> {
    pub source: &'a SourceView,
    pub lines: Lines<'a>,
    pub start: LineIndex,
    pub(crate) grammar: &'a Grammar,
}

impl BlockInput<'_> {
    pub fn line(&self, index: LineIndex) -> &str {
        self.source.text()[self.lines[index].clone()].trim_end_matches('\n')
    }

    pub fn current(&self) -> &str {
        self.line(self.start)
    }

    pub fn interrupts<T: 'static>(&self, index: LineIndex, context: T) -> bool {
        self.interrupts_text(
            self.line(index),
            (index + 1 < self.lines.end()).then(|| self.line(index + 1)),
            context,
        )
    }

    pub fn interrupts_text<T: 'static>(&self, line: &str, next: Option<&str>, context: T) -> bool {
        let probe = BlockProbe {
            line,
            next,
            context: &context,
        };

        self.grammar.data.block.iter().any(|entry| {
            entry
                .data
                .implementation
                .interrupt
                .as_ref()
                .is_some_and(|rule| rule(&probe))
        })
    }
}
