use crate::{Context, Error, Output, Result};
use markdown_ast::{Node, NodeData};
use markdown_definitions::PluginDeclaration as Declaration;
use markdown_definitions::handlers::Handlers;
use std::sync::Arc;

pub(crate) type Handler =
    Arc<dyn Fn(&Node, &Context<'_>, &mut Output<'_>) -> Result<()> + Send + Sync>;

/// An implementation snapshot referring to a shared declaration.
#[derive(Clone)]
pub struct RenderPlugin {
    pub(crate) handlers: Handlers<Handler>,
}

impl RenderPlugin {
    pub fn new(declaration: &Declaration) -> Self {
        Self {
            handlers: Handlers::new(declaration),
        }
    }

    /// Register one handler per payload type. Captured configuration is shared
    /// by every preset and renderer holding this implementation snapshot.
    pub fn on<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>, &mut Output<'_>) -> Result<()>
        + Send
        + Sync
        + 'static,
    ) -> Result<()> {
        self.handlers.on::<T>(erase(handler)).map_err(Into::into)
    }

    /// Render a structural wrapper through the normal child dispatch path.
    pub fn transparent<T: NodeData>(&mut self) -> Result<()> {
        self.on::<T>(|_, children, context, output| context.children(children, output))
    }

    /// Replace an existing handler in this snapshot only. A missing type is an
    /// error and leaves both the handlers and snapshot identity unchanged.
    pub fn replace<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &[Node], &Context<'_>, &mut Output<'_>) -> Result<()>
        + Send
        + Sync
        + 'static,
    ) -> Result<()> {
        self.handlers
            .replace::<T>(erase(handler))
            .map_err(Into::into)
    }
}

fn erase<T: NodeData>(
    handler: impl Fn(&T, &[Node], &Context<'_>, &mut Output<'_>) -> Result<()> + Send + Sync + 'static,
) -> Handler {
    Arc::new(move |node, context, output| {
        let payload = node.payload::<T>().ok_or(Error::InvalidPayload {
            expected: std::any::type_name::<T>(),
        })?;
        handler(payload, &node.children, context, output)
    })
}
