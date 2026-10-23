//! CommonMark payloads and declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod catalog;
pub use catalog::Feature;
mod declarations;
mod nodes;

pub use declarations::{PluginDeclarations, declarations};
pub use nodes::*;
