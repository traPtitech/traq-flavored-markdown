//! traP reference collection rules, independent of parsing and rendering.
#![forbid(unsafe_code)]

pub mod references;
mod uuid;

pub use references::{EmbeddedInfo, References};

/// Recognize the exact hyphenated UUID form used in traQ URLs.
pub use uuid::is_canonical as is_canonical_reference_id;

/// Normalize the UUID representations accepted by traP reference payloads.
pub use uuid::normalize as normalize_reference_id;
