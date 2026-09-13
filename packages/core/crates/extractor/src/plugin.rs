use crate::Result;
use markdown_ast::{Node, NodeData};
use markdown_definitions::Plugin as Declaration;
use markdown_definitions::handlers::Handlers;
use std::sync::Arc;

pub(crate) type Handler<R> = Arc<dyn Fn(&Node, &mut R) -> Result<()> + Send + Sync>;

pub struct Plugin<R> {
    pub(crate) handlers: Handlers<Handler<R>>,
}

impl<R> Clone for Plugin<R> {
    fn clone(&self) -> Self {
        Self {
            handlers: self.handlers.clone(),
        }
    }
}

impl<R> Plugin<R> {
    pub fn new(declaration: &Declaration) -> Self {
        Self {
            handlers: Handlers::new(declaration),
        }
    }

    pub fn on<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &mut R) -> Result<()> + Send + Sync + 'static,
    ) -> Result<()> {
        self.handlers.on::<T>(Arc::new(move |node, result| {
            handler(node.get::<T>().ok_or("invalid_payload")?, result)
        }))
    }
}
