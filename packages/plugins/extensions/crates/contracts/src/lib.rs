//! Node payloads and shared declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod catalog;
pub use catalog::Feature;
mod declarations;
pub use declarations::{PluginDeclarations, declarations};

mod math;
pub use math::*;

mod table;
pub use table::*;

mod mark;
pub use mark::*;

mod strikethrough;
pub use strikethrough::*;

#[doc(hidden)]
pub use markdown_definitions::nodes_from_features as __nodes_from_features;
