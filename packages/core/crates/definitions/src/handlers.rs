//! Shared snapshot and registration rules; handler execution belongs to consumers.
use crate::{Plugin, validate_names};
use std::{any::TypeId, collections::HashMap, sync::Arc};

pub struct Handlers<H> {
    declaration: Plugin,
    entries: Arc<HashMap<TypeId, H>>,
}

impl<H> Clone for Handlers<H> {
    fn clone(&self) -> Self {
        Self {
            declaration: self.declaration.clone(),
            entries: self.entries.clone(),
        }
    }
}

impl<H: Clone> Handlers<H> {
    pub fn new(declaration: &Plugin) -> Self {
        Self {
            declaration: declaration.clone(),
            entries: Arc::default(),
        }
    }

    pub fn on<T: 'static>(&mut self, handler: H) -> Result<(), &'static str> {
        self.set(TypeId::of::<T>(), handler, false)
    }

    pub fn replace<T: 'static>(&mut self, handler: H) -> Result<(), &'static str> {
        self.set(TypeId::of::<T>(), handler, true)
    }

    fn set(&mut self, id: TypeId, handler: H, replacing: bool) -> Result<(), &'static str> {
        if self.entries.contains_key(&id) != replacing {
            return Err(if replacing {
                "missing_handler"
            } else {
                "duplicate_handler"
            });
        }
        Arc::make_mut(&mut self.entries).insert(id, handler);
        Ok(())
    }
}

pub struct HandlerRegistry<H> {
    plugins: Vec<Handlers<H>>,
}

impl<H> Clone for HandlerRegistry<H> {
    fn clone(&self) -> Self {
        Self {
            plugins: self.plugins.clone(),
        }
    }
}

impl<H> Default for HandlerRegistry<H> {
    fn default() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }
}

impl<H: Clone> HandlerRegistry<H> {
    /// Reject conflicts before registering any part of a snapshot.
    pub fn add(&mut self, plugin: &Handlers<H>) -> Result<(), &'static str> {
        for existing in &self.plugins {
            if Arc::ptr_eq(&existing.entries, &plugin.entries) {
                return Err("duplicate_plugin");
            }
            if plugin
                .entries
                .keys()
                .any(|id| existing.entries.contains_key(id))
            {
                return Err("duplicate_handler");
            }
        }
        self.plugins.push(plugin.clone());
        Ok(())
    }

    pub fn remove(&mut self, plugin: &Handlers<H>) -> Result<(), &'static str> {
        let index = self
            .plugins
            .iter()
            .position(|existing| Arc::ptr_eq(&existing.entries, &plugin.entries))
            .ok_or("missing_plugin")?;
        self.plugins.remove(index);
        Ok(())
    }

    pub fn build(self) -> Result<Arc<HashMap<TypeId, H>>, &'static str> {
        validate_names(self.plugins.iter().map(|plugin| &plugin.declaration))
            .map_err(|_| "duplicate_name")?;
        Ok(Arc::new(
            self.plugins
                .iter()
                .flat_map(|plugin| {
                    plugin
                        .entries
                        .iter()
                        .map(|(id, handler)| (*id, handler.clone()))
                })
                .collect(),
        ))
    }
}
