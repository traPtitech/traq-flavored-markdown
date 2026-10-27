//! Reusable parsing mechanics. Syntax and node contracts are supplied by plugins.
#![forbid(unsafe_code)]
#![doc = include_str!("../README.md")]

mod engine;
pub use engine::{Limits, ParseError, ParsePhase, ParseResource, Parser};
pub use grammar::{BuildError, Grammar, GrammarBuilder, SyntaxPlugin};
pub use markdown_ast::{
    AnyPayload, Document, DocumentView, MutableDocument, Node, NodeData, NodeRole, Span,
    ValidationLimits,
};
pub use markdown_definitions::RegistrationHandle;

/// Grammar composition and shared implementation snapshots.
pub mod grammar {
    pub use crate::engine::{BuildError, Grammar, GrammarBuilder, SyntaxPlugin};
    pub use markdown_definitions::{PluginDeclaration, PluginGroup};
}

/// Extension-facing rule inputs, matches, and per-parse state.
pub mod rules {
    pub use crate::engine::{Budget, Contribution, ParseState, Rule};
    pub use crate::engine::{block, inline};
}

/// Checked coordinates and source views supplied to syntax rules.
pub use engine::source;
