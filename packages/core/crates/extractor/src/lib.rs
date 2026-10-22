//! Typed accumulation over a validated tree, independent of syntax and rendering.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod error;
mod extraction;
mod plugin;
mod preset;

pub use error::Error;
pub use extraction::Extractor;
pub use markdown_definitions::RegistrationHandle;
pub use plugin::Plugin;
pub use preset::{Preset, PresetBuilder};
pub type Result<T> = std::result::Result<T, Error>;
