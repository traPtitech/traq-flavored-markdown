use crate::{Plugin, Result, plugin::Handler};
use markdown_definitions::validate_names;
use std::{any::TypeId, collections::HashMap, sync::Arc};

/// Immutable, reusable handlers. No parser or runtime resources are retained.
pub struct Preset<R> {
    pub(crate) handlers: Arc<HashMap<TypeId, Handler<R>>>,
}

pub struct PresetBuilder<R> {
    plugins: Vec<Plugin<R>>,
}

impl<R> PresetBuilder<R> {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check the whole plugin before changing the builder.
    pub fn add(&mut self, plugin: &Plugin<R>) -> Result<&mut Self> {
        for existing in &self.plugins {
            if existing.same(plugin) {
                return Err("duplicate_plugin");
            }
            if plugin
                .handlers
                .keys()
                .any(|id| existing.handlers.contains_key(id))
            {
                return Err("duplicate_handler");
            }
        }

        self.plugins.push(plugin.clone());
        Ok(self)
    }

    /// Remove the registered implementation snapshot, as in GrammarBuilder.
    pub fn remove(&mut self, plugin: &Plugin<R>) -> Result<&mut Self> {
        let index = self
            .plugins
            .iter()
            .position(|p| p.same(plugin))
            .ok_or("missing_plugin")?;

        self.plugins.remove(index);
        Ok(self)
    }

    pub fn build(self) -> Result<Preset<R>> {
        validate_names(self.plugins.iter().map(|plugin| &plugin.declaration))
            .map_err(|_| "duplicate_name")?;

        let handlers = self
            .plugins
            .iter()
            .flat_map(|plugin| {
                plugin
                    .handlers
                    .iter()
                    .map(|(id, handler)| (*id, handler.clone()))
            })
            .collect();

        Ok(Preset {
            handlers: Arc::new(handlers),
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
            plugins: self.plugins.clone(),
        }
    }
}
impl<R> Default for PresetBuilder<R> {
    fn default() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }
}
