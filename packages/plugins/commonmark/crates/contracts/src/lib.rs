//! CommonMark payloads and declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod catalog;
pub use catalog::Feature;
mod declarations;
mod nodes;

pub use declarations::{PluginDeclarations, declarations};
pub use nodes::*;

#[doc(hidden)]
pub use markdown_definitions::nodes_from_features as __nodes_from_features;
