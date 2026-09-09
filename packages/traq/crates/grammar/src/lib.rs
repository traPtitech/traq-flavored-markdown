//! Composable CommonMark and traQ syntax distribution.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

pub mod bindings;
pub mod presets;
pub mod syntax {
    pub use markdown_commonmark as commonmark;
    pub use markdown_generic_syntax as extensions;
    pub use markdown_trap_syntax as trap;
}

pub use markdown_parser::{
    Document, Grammar, GrammarBuilder, Limits, Node, NodeKind, ParseError, Parser, Span, engine,
};
