use crate::{Plugin, RegistrationHandle, Result, plugin::Handler};
use markdown_definitions::handlers::HandlerRegistry;
use std::{any::TypeId, collections::HashMap, sync::Arc};

/// Immutable, reusable handlers. No parser or runtime resources are retained.
#[derive(Clone)]
pub struct Preset {
    pub(crate) handlers: Arc<HashMap<TypeId, Handler>>,
}

#[derive(Clone, Default)]
pub struct PresetBuilder {
    registry: HandlerRegistry<Handler>,
}

impl PresetBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check the whole plugin before changing the builder.
    pub fn add(&mut self, plugin: &Plugin) -> Result<&mut Self> {
        self.register(plugin)?;
        Ok(self)
    }

    pub fn register(&mut self, plugin: &Plugin) -> Result<RegistrationHandle> {
        self.registry.add(&plugin.handlers).map_err(Into::into)
    }

    /// Find a preset's registration by its shared declaration. Snapshot edits do
    /// not change declaration identity or the returned registration handle.
    pub fn registration(&self, plugin: &Plugin) -> Option<RegistrationHandle> {
        self.registry.registration(&plugin.handlers)
    }

    /// Remove the registration even after its original implementation was edited.
    pub fn remove(&mut self, handle: &RegistrationHandle) -> Result<&mut Self> {
        self.registry.remove(handle)?;
        Ok(self)
    }

    pub fn build(self) -> Result<Preset> {
        Ok(Preset {
            handlers: self.registry.build()?,
        })
    }
}
