//! Typed accumulation over a validated tree, independent of syntax and rendering.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod extraction;
mod plugin;
mod preset;

pub use extraction::Extractor;
pub use plugin::Plugin;
pub use preset::{Preset, PresetBuilder};
pub type Result<T> = std::result::Result<T, &'static str>;
