//! Typed text rendering with independently configured plugin handlers.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod plugin;
mod preset;
mod rendering;

pub use plugin::Plugin;
pub use preset::{Preset, PresetBuilder};
pub use rendering::{Context, Renderer};

/// Retains the notification renderer's existing error codes.
pub type Result<T> = std::result::Result<T, &'static str>;
