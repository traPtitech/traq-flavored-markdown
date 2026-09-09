use std::sync::Arc;

/// A typed, shareable rule. Labels describe rules; they never identify them.
#[derive(Clone)]
pub struct Rule<T: Clone> {
    pub(crate) data: Arc<RuleData<T>>,
    label: Option<String>,
}

#[derive(Clone)]
pub(crate) struct RuleData<T: Clone> {
    pub implementation: T,
}

impl<T: Clone> Rule<T> {
    pub(crate) fn from(implementation: T) -> Self {
        Self {
            data: Arc::new(RuleData { implementation }),
            label: None,
        }
    }

    pub fn named(mut self, name: impl Into<String>) -> Self {
        self.label = Some(name.into());
        self
    }

    pub fn name(&self) -> Option<&str> {
        self.label.as_deref()
    }

    pub(crate) fn same(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.data, &other.data)
    }

    pub(crate) fn description(&self) -> String {
        self.name().unwrap_or("<anonymous rule>").into()
    }
}
