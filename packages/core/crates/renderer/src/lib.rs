//! Typed text rendering with independently configured plugin handlers.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

mod error;
mod plugin;
mod preset;
mod rendering;

pub use error::Error;
pub use markdown_definitions::RegistrationHandle;
pub use plugin::RenderPlugin;
pub use preset::{RenderPreset, RenderPresetBuilder};
pub use rendering::{Context, Output, RenderLimits, Renderer};

pub type Result<T> = std::result::Result<T, Error>;
