//! Typed syntax trees with no grammar, serialization, or contract registry dependency.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod data;
mod node;
mod validation;

pub use data::{NodeData, NodeKind, NodeRole};
pub use node::Node;
pub use validation::{ValidatedDocument, ValidationError, ValidationLimits};

/// A half-open UTF-8 byte range in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    /// Check containment, source order, and UTF-8 boundaries for one child.
    pub fn valid_child_of(self, parent: Span, previous_end: usize, source: &str) -> bool {
        self.start <= self.end
            && self.start >= parent.start
            && self.start >= previous_end
            && self.end <= parent.end
            && source.is_char_boundary(self.start)
            && source.is_char_boundary(self.end)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub source: String,
    pub children: Vec<Node>,
}
