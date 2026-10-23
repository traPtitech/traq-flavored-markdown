use crate::{AnalysisContext, Error, Result};
use markdown_ast::NodeData;
use markdown_definitions::Plugin as Declaration;
use markdown_definitions::handlers::Handlers;
use std::sync::Arc;

pub(crate) type Handler<R> = Arc<dyn Fn(AnalysisContext<'_>, &mut R) -> Result<()> + Send + Sync>;

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
        handler: impl Fn(&T, AnalysisContext<'_>, &mut R) -> Result<()> + Send + Sync + 'static,
    ) -> Result<()> {
        self.handlers
            .on::<T>(Arc::new(move |context, result| {
                handler(
                    context.visit.node.get::<T>().ok_or(Error::InvalidPayload {
                        expected: std::any::type_name::<T>(),
                    })?,
                    context,
                    result,
                )
            }))
            .map_err(Into::into)
    }
}
