use crate::{Plugin, Result, plugin::Handler};
use markdown_definitions::handlers::HandlerRegistry;
use std::{any::TypeId, collections::HashMap, sync::Arc};

/// Immutable, reusable handlers. No parser or runtime resources are retained.
pub struct Preset<R> {
    pub(crate) handlers: Arc<HashMap<TypeId, Handler<R>>>,
}

pub struct PresetBuilder<R> {
    registry: HandlerRegistry<Handler<R>>,
}

impl<R> PresetBuilder<R> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check the whole plugin before changing the builder.
    pub fn add(&mut self, plugin: &Plugin<R>) -> Result<&mut Self> {
        self.registry.add(&plugin.handlers)?;
        Ok(self)
    }

    /// Remove the registered implementation snapshot, as in GrammarBuilder.
    pub fn remove(&mut self, plugin: &Plugin<R>) -> Result<&mut Self> {
        self.registry.remove(&plugin.handlers)?;
        Ok(self)
    }

    pub fn build(self) -> Result<Preset<R>> {
        Ok(Preset {
            handlers: self.registry.build()?,
        })
    }
}

impl<R> Clone for Preset<R> {
    fn clone(&self) -> Self {
        Self {
            handlers: self.handlers.clone(),
        }
    }
}
impl<R> Clone for PresetBuilder<R> {
    fn clone(&self) -> Self {
        Self {
            registry: self.registry.clone(),
        }
    }
}
impl<R> Default for PresetBuilder<R> {
    fn default() -> Self {
        Self {
            registry: HandlerRegistry::default(),
        }
    }
}
