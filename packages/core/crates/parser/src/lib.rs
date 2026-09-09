//! Reusable parsing mechanics. Syntax and node contracts are supplied by plugins.
#![forbid(unsafe_code)]
#![allow(clippy::single_range_in_vec_init)]
#![doc = include_str!("../README.md")]

pub use markdown_ast::{Document, Node, NodeData, NodeKind, Span};
pub mod engine;
pub use engine::{BuildError, Grammar, GrammarBuilder, Limits, ParseError, Parser, Plugin};

/// Distribution metadata. Applications normally use generated preset instances.
pub mod bindings;
