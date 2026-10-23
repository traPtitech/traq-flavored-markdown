//! Node payloads and shared declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod catalog;
pub use catalog::Feature;
mod declarations;
pub use declarations::{PluginDeclarations, declarations};

mod reference;
pub use reference::*;

mod stamp;
pub use stamp::*;

mod spoiler;
pub use spoiler::*;

mod spacing;
pub use spacing::*;

mod embedding;
pub use embedding::*;

mod identity;
pub use identity::{ReferenceId, ReferenceIdentity};

#[doc(hidden)]
pub use markdown_definitions::nodes_from_features as __nodes_from_features;
