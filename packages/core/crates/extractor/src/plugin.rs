use crate::Result;
use markdown_ast::{Node, NodeData};
use markdown_definitions::Plugin as Declaration;
use std::{any::TypeId, collections::HashMap, sync::Arc};

pub(crate) type Handler<R> = Arc<dyn Fn(&Node, &mut R) -> Result<()> + Send + Sync>;

pub struct Plugin<R> {
    pub(crate) declaration: Declaration,
    pub(crate) handlers: Arc<HashMap<TypeId, Handler<R>>>,
}

impl<R> Clone for Plugin<R> {
    fn clone(&self) -> Self {
        Self {
            declaration: self.declaration.clone(),
            handlers: self.handlers.clone(),
        }
    }
}

impl<R> Plugin<R> {
    pub fn new(declaration: &Declaration) -> Self {
        Self {
            declaration: declaration.clone(),
            handlers: Arc::new(HashMap::new()),
        }
    }

    pub fn on<T: NodeData>(
        &mut self,
        handler: impl Fn(&T, &mut R) -> Result<()> + Send + Sync + 'static,
    ) -> Result<()> {
        let id = TypeId::of::<T>();
        if self.handlers.contains_key(&id) {
            return Err("duplicate_handler");
        }

        Arc::make_mut(&mut self.handlers).insert(
            id,
            Arc::new(move |node, result| {
                handler(node.get::<T>().ok_or("invalid_payload")?, result)
            }),
        );
        Ok(())
    }

    pub(crate) fn same(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.handlers, &other.handlers)
    }
}
