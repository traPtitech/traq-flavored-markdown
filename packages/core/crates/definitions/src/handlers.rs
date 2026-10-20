//! Shared snapshot and registration rules; handler execution belongs to consumers.
use crate::{
    Plugin, RegistrationError, RegistrationErrorKind as ErrorKind, RegistrationHandle,
    validate_names,
};
use std::{any::TypeId, collections::HashMap, sync::Arc};

pub struct Handlers<H> {
    declaration: Plugin,
    entries: Arc<HashMap<TypeId, H>>,
    types: Arc<HashMap<TypeId, &'static str>>,
}

impl<H> Clone for Handlers<H> {
    fn clone(&self) -> Self {
        Self {
            declaration: self.declaration.clone(),
            entries: self.entries.clone(),
            types: self.types.clone(),
        }
    }
}

impl<H: Clone> Handlers<H> {
    pub fn new(declaration: &Plugin) -> Self {
        Self {
            declaration: declaration.clone(),
            entries: Arc::default(),
            types: Arc::default(),
        }
    }

    pub fn on<T: 'static>(&mut self, handler: H) -> Result<(), RegistrationError> {
        self.set::<T>(handler, false)
    }

    pub fn replace<T: 'static>(&mut self, handler: H) -> Result<(), RegistrationError> {
        self.set::<T>(handler, true)
    }

    fn set<T: 'static>(&mut self, handler: H, replacing: bool) -> Result<(), RegistrationError> {
        let id = TypeId::of::<T>();
        if self.entries.contains_key(&id) != replacing {
            return Err(RegistrationError::new(
                if replacing {
                    ErrorKind::MissingHandler
                } else {
                    ErrorKind::DuplicateHandler
                },
                &self.declaration,
                Some(std::any::type_name::<T>()),
            ));
        }
        Arc::make_mut(&mut self.entries).insert(id, handler);
        Arc::make_mut(&mut self.types).insert(id, std::any::type_name::<T>());
        Ok(())
    }
}

pub struct HandlerRegistry<H> {
    plugins: Vec<(RegistrationHandle, Handlers<H>)>,
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
    pub fn registration(&self, plugin: &Handlers<H>) -> Option<RegistrationHandle> {
        self.plugins
            .iter()
            .find(|(_, existing)| existing.declaration == plugin.declaration)
            .map(|(handle, _)| handle.clone())
    }

    /// Reject conflicts before registering any part of a snapshot.
    pub fn add(&mut self, plugin: &Handlers<H>) -> Result<RegistrationHandle, RegistrationError> {
        for (_, existing) in &self.plugins {
            if Arc::ptr_eq(&existing.entries, &plugin.entries) {
                return Err(RegistrationError::new(
                    ErrorKind::DuplicatePlugin,
                    &plugin.declaration,
                    None,
                ));
            }
            if let Some(id) = plugin
                .entries
                .keys()
                .find(|id| existing.entries.contains_key(id))
            {
                return Err(RegistrationError::new(
                    ErrorKind::DuplicateHandler,
                    &plugin.declaration,
                    plugin.types.get(id).copied(),
                ));
            }
        }
        let handle = RegistrationHandle::new(&plugin.declaration);
        self.plugins.push((handle.clone(), plugin.clone()));
        Ok(handle)
    }

    pub fn remove(&mut self, handle: &RegistrationHandle) -> Result<(), RegistrationError> {
        let index = self
            .plugins
            .iter()
            .position(|(existing, _)| existing == handle)
            .ok_or_else(|| {
                RegistrationError::new(ErrorKind::MissingPlugin, handle.plugin(), None)
            })?;
        self.plugins.remove(index);
        Ok(())
    }

    pub fn build(self) -> Result<Arc<HashMap<TypeId, H>>, RegistrationError> {
        validate_names(self.plugins.iter().map(|(_, plugin)| &plugin.declaration)).map_err(
            |error| RegistrationError {
                kind: ErrorKind::DuplicateName,
                plugin: error.name,
                payload_type: None,
                scope: Some(error.scope),
            },
        )?;
        Ok(Arc::new(
            self.plugins
                .iter()
                .flat_map(|(_, plugin)| {
                    plugin
                        .entries
                        .iter()
                        .map(|(id, handler)| (*id, handler.clone()))
                })
                .collect(),
        ))
    }
}
