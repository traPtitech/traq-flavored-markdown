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
pub struct PluginDeclaration(Arc<Declaration>);

impl PluginDeclaration {
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

impl PartialEq for PluginDeclaration {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

impl Eq for PluginDeclaration {}

#[derive(Clone, Debug)]
pub struct PluginGroup(Arc<Declaration>);

impl PluginGroup {
    #[must_use]
    pub fn group(&self, name: impl Into<String>) -> Self {
        Self(Declaration::new(Some(self), name))
    }

    /// Create a plugin declaration within this namespace.
    pub fn plugin(&self, name: impl Into<String>) -> PluginDeclaration {
        PluginDeclaration(Declaration::new(Some(self), name))
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
