//! Composable CommonMark and traQ syntax distribution.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

pub mod bindings;
pub mod presets;
pub mod syntax {
    pub use markdown_commonmark as commonmark;
    pub use markdown_extensions_syntax as extensions;
    pub use markdown_trap_syntax as trap;
}

pub use markdown_parser::{
    Document, DocumentView, Grammar, GrammarBuilder, Limits, MutableDocument, Node, NodeKind,
    NodeRole, ParseError, Parser, Span, ValidationLimits, engine,
};
