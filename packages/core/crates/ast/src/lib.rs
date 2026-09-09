//! Typed syntax trees with no grammar, serialization, or contract registry dependency.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod data;
mod node;
mod validation;

pub use data::{NodeData, NodeKind};
pub use node::Node;
pub use validation::{ValidationError, ValidationLimits};

/// A half-open UTF-8 byte range in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Document {
    pub source: String,
    pub children: Vec<Node>,
}
