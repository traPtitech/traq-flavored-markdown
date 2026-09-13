//! CommonMark payloads and declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod declarations;
mod nodes;

pub use declarations::{Contracts, preset};
pub use nodes::*;
