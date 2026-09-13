//! traP reference collection rules, independent of parsing and rendering.
#![forbid(unsafe_code)]

pub mod references;
mod uuid;

pub use references::{EmbeddedInfo, References};

/// Normalize the UUID representations accepted by traP reference payloads.
pub use uuid::normalize as normalize_reference_id;
