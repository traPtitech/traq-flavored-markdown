use crate::Plugin;
use std::sync::Arc;

/// The identity of one registration in a builder. Editing an implementation
/// snapshot does not change this handle. Cloned builders preserve their handles.
#[derive(Debug, Clone)]
pub struct RegistrationHandle {
    identity: Arc<()>,
    plugin: Plugin,
}

impl RegistrationHandle {
    pub fn new(plugin: &Plugin) -> Self {
        Self {
            identity: Arc::new(()),
            plugin: plugin.clone(),
        }
    }
    pub fn plugin(&self) -> &Plugin {
        &self.plugin
    }
}
impl PartialEq for RegistrationHandle {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.identity, &other.identity)
    }
}
impl Eq for RegistrationHandle {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistrationErrorKind {
    DuplicatePlugin,
    MissingPlugin,
    DuplicateHandler,
    MissingHandler,
    DuplicateName,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistrationError {
    pub kind: RegistrationErrorKind,
    pub plugin: String,
    pub payload_type: Option<&'static str>,
    pub scope: Option<String>,
}
impl RegistrationError {
    pub(crate) fn new(
        kind: RegistrationErrorKind,
        plugin: &Plugin,
        payload_type: Option<&'static str>,
    ) -> Self {
        Self {
            kind,
            plugin: plugin.name().into(),
            payload_type,
            scope: None,
        }
    }
    pub fn code(&self) -> &'static str {
        match self.kind {
            RegistrationErrorKind::DuplicatePlugin => "duplicate_plugin",
            RegistrationErrorKind::MissingPlugin => "missing_plugin",
            RegistrationErrorKind::DuplicateHandler => "duplicate_handler",
            RegistrationErrorKind::MissingHandler => "missing_handler",
            RegistrationErrorKind::DuplicateName => "duplicate_name",
        }
    }
}
impl std::fmt::Display for RegistrationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} in plugin {:?}", self.code(), self.plugin)?;
        if let Some(payload) = self.payload_type {
            write!(f, " for {payload}")?;
        }
        if let Some(scope) = &self.scope {
            write!(f, " in {scope}")?;
        }
        Ok(())
    }
}
impl std::error::Error for RegistrationError {}
