//! traQ processing presets, composed without a parser or AST codec dependency.
#![forbid(unsafe_code)]

mod links;
pub mod presets;
pub mod rendering;

pub use markdown_trap_extraction::References;

pub mod extraction;
