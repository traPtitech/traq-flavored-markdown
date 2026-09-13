//! Node payloads and shared declarations. No parser, renderer, or codec dependency.
#![forbid(unsafe_code)]

mod declarations;
pub use declarations::{Contracts, preset};

mod math;
pub use math::*;

mod table;
pub use table::*;

mod mark;
pub use mark::*;

mod strikethrough;
pub use strikethrough::*;
