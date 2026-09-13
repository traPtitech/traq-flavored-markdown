use crate::{Plugin, Result, plugin::Handler};
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
        self.registry.add(&plugin.handlers)?;
        Ok(self)
    }

    /// Remove the registered implementation snapshot, as in GrammarBuilder.
    pub fn remove(&mut self, plugin: &Plugin) -> Result<&mut Self> {
        self.registry.remove(&plugin.handlers)?;
        Ok(self)
    }

    pub fn build(self) -> Result<Preset> {
        Ok(Preset {
            handlers: self.registry.build()?,
        })
    }
}
