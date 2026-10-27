//! Shared declarations and generated type metadata. No AST or serde dependencies.
#![doc = include_str!("../README.md")]
#![forbid(unsafe_code)]

// Derive expansions use the package name even when invoked inside this crate.
extern crate self as markdown_definitions;

mod features;
mod names;
mod namespace;
mod registration;
mod wire_type;

pub mod handlers;

pub use features::{FeatureContract, PayloadContract};
pub use markdown_definitions_derive::WireTypeKey;
pub use markdown_definitions_derive::node;
pub use markdown_definitions_derive::payload;
pub use names::{NameCollision, validate_names};
pub use namespace::{PluginDeclaration, PluginGroup};
pub use registration::{RegistrationError, RegistrationErrorKind, RegistrationHandle};
pub use wire_type::WireTypeKey;
