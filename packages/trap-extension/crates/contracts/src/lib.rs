//! Node payloads and shared declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod declarations;
pub use declarations::{Contracts, preset};

mod reference;
pub use reference::*;

mod stamp;
pub use stamp::*;

mod spoiler;
pub use spoiler::*;

mod compat;
pub use compat::*;

mod embedding;
pub use embedding::*;
