mod input;
mod rule;
pub use rule::BlockRule;
mod draft;
mod scan;

use super::{Grammar, source::SourceView};
pub use draft::{DraftContent, DraftNode};
pub(crate) use scan::parse;
use std::ops::Range;

pub struct BlockBatch {
    pub nodes: Vec<DraftNode>,
    pub loose: bool,
}

pub struct Definition {
    pub key: String,
    pub destination: String,
    pub title: Option<String>,
}

pub(crate) type References = std::collections::HashMap<String, (String, Option<String>)>;

pub struct BlockMatch {
    pub end: usize,
    pub nodes: Vec<DraftNode>,
    pub definitions: Vec<Definition>,
    pub consume_separator: bool,
}

impl BlockMatch {
    pub fn node(end: usize, node: DraftNode) -> Self {
        Self {
            end,
            nodes: vec![node],
            definitions: vec![],
            consume_separator: true,
        }
    }

    pub fn ignore(end: usize) -> Self {
        Self {
            end,
            nodes: vec![],
            definitions: vec![],
            consume_separator: false,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Interrupt {
    Paragraph,
    LazyContinuation,
    Reference,
    BlockBody,
}

pub struct BlockProbe<'a> {
    pub line: &'a str,
    pub next: Option<&'a str>,
    pub context: Interrupt,
}

pub struct BlockInput<'a> {
    pub source: &'a SourceView,
    pub lines: &'a [Range<usize>],
    pub start: usize,
    pub(crate) grammar: &'a Grammar,
}

impl BlockInput<'_> {
    pub fn line(&self, index: usize) -> &str {
        self.source.text[self.lines[index].clone()].trim_end_matches('\n')
    }

    pub fn current(&self) -> &str {
        self.line(self.start)
    }

    pub fn interrupts(&self, index: usize, context: Interrupt) -> bool {
        self.interrupts_text(
            self.line(index),
            (index + 1 < self.lines.len()).then(|| self.line(index + 1)),
            context,
        )
    }

    pub fn interrupts_text(&self, line: &str, next: Option<&str>, context: Interrupt) -> bool {
        let probe = BlockProbe {
            line,
            next,
            context,
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
