//! traQ processing presets, composed without a parser or AST codec dependency.
#![forbid(unsafe_code)]

mod collectors;
mod edits;
mod error;
mod links;
pub mod presets;
pub mod rendering;
pub mod pipeline;

pub use error::{Error, ErrorCategory};
pub use markdown_trap_extraction::References;
pub type Result<T> = std::result::Result<T, Error>;

pub mod extraction;
