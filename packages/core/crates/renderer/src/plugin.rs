use crate::{Context, Result};
use markdown_ast::{Node, NodeData};
use markdown_definitions::Plugin as Declaration;
use markdown_definitions::handlers::Handlers;
use std::sync::Arc;

pub(crate) type Handler = Arc<dyn Fn(&Node, &Context<'_>) -> Result<String> + Send + Sync>;

/// An implementation snapshot referring to a shared declaration.
#[derive(Clone)]
pub struct Plugin {
    pub(crate) handlers: Handlers<Handler>,
}

impl Plugin {
    pub fn new(declaration: &Declaration) -> Self {
        Self {
            handlers: Handlers::new(declaration),
        }
    }

    /// Register one handler per payload type. Captured configuration is shared
    /// by every preset and renderer holding this implementation snapshot.
    pub fn on<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>) -> Result<String> + Send + Sync + 'static,
    ) -> Result<()> {
        self.handlers.on::<T>(erase(handler))
    }

    /// Replace an existing handler in this snapshot only. A missing type is an
    /// error and leaves both the handlers and snapshot identity unchanged.
    pub fn replace<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>) -> Result<String> + Send + Sync + 'static,
    ) -> Result<()> {
        self.handlers.replace::<T>(erase(handler))
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
