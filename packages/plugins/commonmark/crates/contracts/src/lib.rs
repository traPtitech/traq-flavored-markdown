//! CommonMark payloads and declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod catalog;
mod declarations;
mod nodes;

pub use declarations::{PluginDeclarations, declarations};
pub use nodes::*;
