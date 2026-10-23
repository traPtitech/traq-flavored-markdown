//! Typed accumulation over a validated tree, independent of syntax and rendering.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod analysis;
mod error;
mod extraction;
mod plugin;
mod preset;

pub use analysis::{AnalysisContext, Collector, collect};
pub use error::Error;
pub use extraction::{Extraction, Extractor};
pub use markdown_definitions::RegistrationHandle;
pub use plugin::Plugin;
pub use preset::{Preset, PresetBuilder};
pub type Result<T> = std::result::Result<T, Error>;
