use super::SourceView;
use std::{any::Any, sync::Arc};

impl SourceView {
    /// Reads extension-owned state inherited by this view.
    ///
    /// Use a private type to keep unrelated extensions' state separate.
    /// Values belong to the source view, not to the reusable Parser.
    pub fn context<T: Any>(&self) -> Option<&T> {
        self.context.iter().find_map(|value| value.downcast_ref())
    }

    /// Sets this view's state for T, replacing any value of the same type.
    ///
    /// Derived views inherit shared values. Replacing one does not replace
    /// its parent or siblings' values. Interior mutability inside T is shared;
    /// use immutable values when changes must stay local to a child view.
    /// Extension code is responsible for budgeting work on its own values.
    pub fn set_context<T: Any + Send + Sync>(&mut self, value: T) {
        if let Some(slot) = self.context.iter_mut().find(|value| value.is::<T>()) {
            *slot = Arc::new(value);
        } else {
            self.context.push(Arc::new(value));
        }
    }
}
