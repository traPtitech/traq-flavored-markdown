//! Reusable parsing mechanics. Syntax and node contracts are supplied by plugins.
#![forbid(unsafe_code)]
#![allow(clippy::single_range_in_vec_init)]
#![doc = include_str!("../README.md")]

pub use markdown_ast::{
    Document, DocumentView, MutableDocument, Node, NodeData, NodeKind, NodeRole, Span,
    ValidationLimits,
};
pub mod engine;
pub use engine::{BuildError, Grammar, GrammarBuilder, Limits, ParseError, Parser, Plugin};
pub use markdown_definitions::RegistrationHandle;
