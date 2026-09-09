//! JSON belongs at the boundary. Semantic types and validators belong to contracts.
#![forbid(unsafe_code)]

mod fields;
mod output;
mod receive;
mod registry;

pub use receive::DecodeLimits;
pub use registry::Codec;
