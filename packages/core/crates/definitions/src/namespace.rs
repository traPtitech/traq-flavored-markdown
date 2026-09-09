use std::sync::Arc;

#[derive(Debug)]
struct Declaration {
    parent: Option<PluginGroup>,
    name: String,
}

impl Declaration {
    fn new(parent: Option<&PluginGroup>, name: impl Into<String>) -> Arc<Self> {
        Arc::new(Self {
            parent: parent.cloned(),
            name: name.into(),
        })
    }
}

/// A shared plugin declaration. Names are for people; identity is instance based.
#[derive(Clone, Debug)]
pub struct Plugin(Arc<Declaration>);

impl Plugin {
    pub fn new(name: impl Into<String>) -> Self {
        Self(Declaration::new(None, name))
    }

    pub fn group(name: impl Into<String>) -> PluginGroup {
        PluginGroup(Declaration::new(None, name))
    }

    pub fn name(&self) -> &str {
        &self.0.name
    }
    /// The shared namespace declaration. Names remain display labels only.
    pub fn namespace(&self) -> Option<&PluginGroup> {
        self.0.parent.as_ref()
    }
}

impl PartialEq for Plugin {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

impl Eq for Plugin {}

#[derive(Clone, Debug)]
pub struct PluginGroup(Arc<Declaration>);

impl PluginGroup {
    pub fn group(&self, name: impl Into<String>) -> Self {
        Self(Declaration::new(Some(self), name))
    }

    // A group's new() creates a plugin, matching the agreed namespace API.
    #[allow(clippy::new_ret_no_self)]
    pub fn new(&self, name: impl Into<String>) -> Plugin {
        Plugin(Declaration::new(Some(self), name))
    }

    pub fn name(&self) -> &str {
        &self.0.name
    }

    pub fn parent(&self) -> Option<&Self> {
        self.0.parent.as_ref()
    }
}

impl PartialEq for PluginGroup {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

impl Eq for PluginGroup {}
