//! traQ processing presets, composed without a parser or AST codec dependency.
#![forbid(unsafe_code)]

mod edits;
mod error;
mod links;
pub mod pipeline;
pub mod presets;
pub mod rendering;

pub use error::{Error, ErrorCategory};
pub use markdown_traq_extraction::References;
pub type Result<T> = std::result::Result<T, Error>;

pub mod extraction;
