use crate::{Context, Result};
use markdown_ast::{Node, NodeData};
use markdown_definitions::Plugin as Declaration;
use std::{any::TypeId, collections::HashMap, sync::Arc};

pub(crate) type Handler = Arc<dyn Fn(&Node, &Context<'_>) -> Result<String> + Send + Sync>;

/// An implementation snapshot referring to a shared declaration.
#[derive(Clone)]
pub struct Plugin {
    pub(crate) declaration: Declaration,
    pub(crate) handlers: Arc<HashMap<TypeId, Handler>>,
}

impl Plugin {
    pub fn new(declaration: &Declaration) -> Self {
        Self {
            declaration: declaration.clone(),
            handlers: Arc::new(HashMap::new()),
        }
    }

    /// Register one handler per payload type. Captured configuration is shared
    /// by every preset and renderer holding this implementation snapshot.
    pub fn on<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>) -> Result<String> + Send + Sync + 'static,
    ) -> Result<()> {
        let id = TypeId::of::<T>();
        if self.handlers.contains_key(&id) {
            return Err("duplicate_handler");
        }

        Arc::make_mut(&mut self.handlers).insert(id, erase(handler));
        Ok(())
    }

    /// Replace an existing handler in this snapshot only. A missing type is an
    /// error and leaves both the handlers and snapshot identity unchanged.
    pub fn replace<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>) -> Result<String> + Send + Sync + 'static,
    ) -> Result<()> {
        let id = TypeId::of::<T>();
        if !self.handlers.contains_key(&id) {
            return Err("missing_handler");
        }

        Arc::make_mut(&mut self.handlers).insert(id, erase(handler));
        Ok(())
    }

    pub(crate) fn same(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.handlers, &other.handlers)
    }
}

fn erase<T: NodeData>(
    handler: impl Fn(&T, &[Node], &Context<'_>) -> Result<String> + Send + Sync + 'static,
) -> Handler {
    Arc::new(move |node, context| {
        let payload = node.get::<T>().ok_or("invalid_payload")?;
        handler(payload, &node.children, context)
    })
}
