//! JSON belongs at the boundary. Semantic types and validators belong to contracts.
#![forbid(unsafe_code)]

mod fields;
mod limits;
mod output;
mod receive;
mod registry;

pub use limits::CodecLimits;
pub use limits::CodecLimits as DecodeLimits;
pub use registry::Codec;
