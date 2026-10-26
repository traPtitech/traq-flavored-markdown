use crate::{ExtractionPlugin, RegistrationHandle, Result, plugin::Handler};
use markdown_definitions::handlers::HandlerRegistry;
use std::{any::TypeId, collections::HashMap, sync::Arc};

/// Immutable, reusable handlers. No parser or runtime resources are retained.
pub struct ExtractionPreset<R> {
    pub(crate) handlers: Arc<HashMap<TypeId, Handler<R>>>,
}

pub struct ExtractionPresetBuilder<R> {
    registry: HandlerRegistry<Handler<R>>,
}

impl<R> ExtractionPresetBuilder<R> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check the whole plugin before changing the builder.
    pub fn add(&mut self, plugin: &ExtractionPlugin<R>) -> Result<&mut Self> {
        self.register(plugin)?;
        Ok(self)
    }

    pub fn register(&mut self, plugin: &ExtractionPlugin<R>) -> Result<RegistrationHandle> {
        self.registry.add(&plugin.handlers).map_err(Into::into)
    }

    pub fn registration(&self, plugin: &ExtractionPlugin<R>) -> Option<RegistrationHandle> {
        self.registry.registration(&plugin.handlers)
    }

    /// Remove the registration independently of later implementation edits.
    pub fn remove(&mut self, handle: &RegistrationHandle) -> Result<&mut Self> {
        self.registry.remove(handle)?;
        Ok(self)
    }

    pub fn build(self) -> Result<ExtractionPreset<R>> {
        Ok(ExtractionPreset {
            handlers: self.registry.build()?,
        })
    }
}

impl<R> Clone for ExtractionPreset<R> {
    fn clone(&self) -> Self {
        Self {
            handlers: self.handlers.clone(),
        }
    }
}
impl<R> Clone for ExtractionPresetBuilder<R> {
    fn clone(&self) -> Self {
        Self {
            registry: self.registry.clone(),
        }
    }
}
impl<R> Default for ExtractionPresetBuilder<R> {
    fn default() -> Self {
        Self {
            registry: HandlerRegistry::default(),
        }
    }
}
